import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";
import fs from "fs";
import getContentLocation from "../get-content-location";

// https://tools.ietf.org/html/rfc7232#section-6

function processIfUnmodifiedSince(request: Request, options: FSStoreOptions, stat: fs.Stats): Response {
  const ifUnmodifiedSince = request.headers.get("If-Unmodified-Since");
  const date = new Date(ifUnmodifiedSince);

  if (date.getTime() > new Date(stat.mtime).getTime()) {
    return undefined;
  }

  return new Response(undefined, {
    status: 412,
    statusText: options.statusCodes[412]
  });
}

function processIfModifiedSince(request: Request, options: FSStoreOptions, stat: fs.Stats): Response {
  const ifModifiedSince = request.headers.get("If-Modified-Since");
  const date = new Date(ifModifiedSince);

  if (date.getTime() < new Date(stat.mtime).getTime()) {
    return undefined;
  }

  return new Response(undefined, {
    status: 304,
    statusText: options.statusCodes[304]
  });
}

async function links(request: Request, stat: fs.Stats, response: Response, options: FSStoreOptions, ) {
  if (!options.getLinks) {
    return;
  }
  const links = await options.getLinks(request, response, stat);
  const linkValues = response.headers.getAll("Link");
  links.forEach(
    ([rel, value]) => {
      linkValues.push(`<${value}>; rel="${rel}"`);
    }
  );
  response.headers.set("Link", linkValues.join(", "));
}

async function handleHeadMethod(request: Request, options: FSStoreOptions): Promise<Response> {

  const { contentLocation, stat } = await getContentLocation(request, options);

  const headers = new Headers();

  if (contentLocation && new URL(contentLocation).pathname !== new URL(request.url).pathname) {
    headers.set("Content-Location", contentLocation);
  }

  if (!stat) {
    return new Response(undefined, {
      status: 404,
      statusText: options.statusCodes[404],
      headers
    });
  }

  const processors: { [key: string]: (request: Request, options: FSStoreOptions, stat: fs.Stats) => Response} = {
    "If-Modified-Since": processIfModifiedSince,
    "If-Unmodified-Since": processIfUnmodifiedSince
  };

  const earlyResponse = Object.keys(processors)
    .filter(header => request.headers.has(header))
    .reduce((response, header) => {
      if (response) {
        return response;
      }
      return (processors[header] as any)(request, options, stat);
    }, undefined);

  const response: Response = earlyResponse || new Response(undefined, {
    status: 200,
    statusText: options.statusCodes[200],
    headers
  });

  if (options.getContentType) {
    const contentType = await options.getContentType(request, contentLocation);
    /*
     Allow Content-Type to be set at head level, we can do this here, and then later on for
     get requests, this means we can do a generic content-type at HEAD level, then when the entity
     is requested, we can expand further (aka parameters)
      */
    if (contentType) {
      response.headers.set("Content-Type", contentType);
    }
  }

  response.headers.set("Last-Modified", new Date(stat.mtime).toUTCString());
  response.headers.set("Content-Length", stat.size.toString());

  await links(request, stat, response, options);

  return response;
}

export default handleHeadMethod;
