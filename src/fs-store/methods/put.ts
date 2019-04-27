import { FSStoreOptions } from "../options";
import { Request, Response, asBuffer } from "@opennetwork/http-representation";
import getPath from "../get-path";
import fs from "fs";
import getContentLocation from "../get-content-location";
import { Fetcher } from "./";

function isMakeDirectoryAvailable(options: FSStoreOptions): boolean {
  if (!options.mkdirp) {
    return false;
  }
  // They requested to not check for rimraf functions, so they must have their own implementation
  if (options.mkdirp.noFSFunctionCheck) {
    return true;
  }
  const required = [
    "mkdir",
    "stat"
  ];
  const missing = required.findIndex(name => !((options.fs as any)[name] instanceof Function));
  return missing === -1;
}

async function ensureDirectoryExists(path: string, options: FSStoreOptions): Promise<any> {
  const directoryPath = path.substr(0, path.lastIndexOf("/") + 1);
  if (!directoryPath) {
    // Root path must have been "." or empty
    return;
  }
  const stat: fs.Stats = await new Promise(
    resolve => options.fs.stat(
      directoryPath,
      (error, stat) => resolve(error ? undefined : stat)
    )
  );
  if (stat && stat.isDirectory()) {
    return;
  } else if (stat) {
    throw new Error("");
  }
  if (!isMakeDirectoryAvailable(options)) {
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501],
      headers: {
        Warning: "199 - Cannot create directory, not all required fs methods are available"
      }
    });
  }
  return new Promise(
    (resolve, reject) => options.mkdirp(
      directoryPath,
      {
        fs: options.fs
      },
      (error) => error ? reject(error) : resolve()
    )
  );
}

async function handlePutMethod(request: Request, options: FSStoreOptions, fetch: Fetcher): Promise<Response> {
  const { contentLocation } = await getContentLocation(request, options);

  const headResponse = await fetch(
    new Request(
      contentLocation || request.url,
      {
        method: "HEAD",
        headers: request.headers
      }
    ),
    {
      ignoreLock: true
    }
  );

  // 404 is okay, as we will create it
  if (!headResponse.ok && headResponse.status !== 404) {
    return headResponse;
  }

  const path = await getPath(contentLocation || request.url, options);

  if (path.endsWith("/")) {
    return new Response(undefined, {
      status: 400,
      statusText: options.statusCodes[400],
      headers: {
        Warning: "199 - Cannot write to directory"
      }
    });
  }

  const earlyResponse = await ensureDirectoryExists(path, options);

  if (earlyResponse) {
    return earlyResponse;
  }

  const body = await asBuffer(request)
    .then(value => value === undefined ? Uint8Array.from([]) : value);

  await new Promise(
    (resolve, reject) => options.fs.writeFile(
      path,
      body,
      (error) => error ? reject(error) : resolve()
    )
  );

  const stat: fs.Stats = await new Promise(
    resolve => options.fs.stat(
      path,
      (error, stat) => resolve(error ? undefined : stat)
    )
  );

  // Just do a sanity check to see if we saved correctly
  if (!(stat && stat.isFile())) {
    return new Response(undefined, {
      status: 500,
      statusText: options.statusCodes[500],
      headers: {
        Warning: "199 - Could not save file"
      }
    });
  }

  const status = headResponse.status === 404 ? 201 : 204;

  const response = new Response(undefined, {
    status,
    statusText: options.statusCodes[status],
    headers: headResponse.headers
  });

  response.headers.set("Last-Modified", stat.mtime.toUTCString());

  if (status === 201) {
    response.headers.set("Location", request.url);
  }

  // Content-Length is set by HEAD, but we don't want it to be returned
  response.headers.delete("Content-Length");

  return response;
}

export default handlePutMethod;
