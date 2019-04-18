import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";
import getPath from "../get-path";
import fs from "fs";

// https://tools.ietf.org/html/rfc7232#section-6

function processIfUnmodifiedSince(request: Request, options: FSStoreOptions, stat: fs.Stats): Response {
  const ifUnmodifiedSince = request.headers.get("If-Unmodified-Since");
  const date = new Date(ifUnmodifiedSince);

  if (date.getTime() > stat.mtime.getTime()) {
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

  if (date.getTime() < stat.mtime.getTime()) {
    return undefined;
  }

  return new Response(undefined, {
    status: 304,
    statusText: options.statusCodes[304]
  });
}

export async function getContentLocation(request: Request, options: FSStoreOptions): Promise<{ contentLocation?: string, stat: fs.Stats }> {

  let contentLocation;

  // This allows an implementor to escape this entire process, if they return undefined, we'll use the original and not try and resolve
  // a content location
  if (options.getContentLocation) {
    contentLocation = await options.getContentLocation(request, async (url: string) => getPath(url, options));
  }

  const givenPath = await getPath(contentLocation || request.url, options);

  async function stat(path: string): Promise<fs.Stats> {
    return new Promise(
      resolve => options.fs.stat(
        path,
        (error, stat) => resolve(error ? undefined : stat)
      )
    );
  }

  const givenPathStat = await stat(givenPath);

  if (!options.getPossibleSuffixes || options.getContentLocation) {
    return { stat: givenPathStat, contentLocation }; // Doesn't matter what it is, they aren't trying out extensions
  }

  if (givenPathStat && givenPathStat.isFile()) {
    return { stat: givenPathStat };
  }

  const suffixes = await options.getPossibleSuffixes(request, givenPath);

  if (!suffixes.length) {
    // No contentLocation needed
    return { stat: givenPathStat };
  }

  // Filter through the available
  const { suffix, stat: suffixStat } = await suffixes.reduce(
    async (previous, suffix): Promise<{ suffix: string, stat: fs.Stats }> => {
      const previousSuffixFound = await previous;
      if (previousSuffixFound.stat && previousSuffixFound.stat.isFile()) {
        return previousSuffixFound;
      }
      return {
        stat: await stat(`${givenPath}${suffix}`),
        suffix
      };
    },
    Promise.resolve({ suffix: "", stat: givenPathStat })
  );

  const url = new URL(request.url);
  // Only append to the path, not the query or anything
  url.pathname += suffix;
  return {
    contentLocation: url.toString(),
    stat: suffixStat
  };
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

  response.headers.set("Last-Modified", stat.mtime.toUTCString());
  response.headers.set("Content-Length", stat.size.toString());

  return response;
}

export default handleHeadMethod;
