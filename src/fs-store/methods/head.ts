import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
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

async function handleHeadMethod(request: Request, options: FSStoreOptions): Promise<Response> {
  const path = await getPath(request.url, options);

  const stat: fs.Stats = await new Promise(
    resolve => options.fs.stat(
      path,
      (error, stat) => resolve(error ? undefined : stat)
    )
  );

  if (!stat) {
    return new Response(undefined, {
      status: 404,
      statusText: options.statusCodes[404]
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
    statusText: options.statusCodes[200]
  });

  response.headers.set("Last-Modified", stat.mtime.toUTCString());
  response.headers.set("Content-Length", stat.size.toString());

  return response;
}

export default handleHeadMethod;
