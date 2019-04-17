import { FSStoreOptions } from "../options";
import { Request, Response, asBuffer } from "@opennetwork/http-representation";
import getPath from "../get-path";
import fs from "fs";

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

async function handlePutMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  const headResponse = await fetch(new Request(request.url, {
    headers: request.headers,
    method: "HEAD"
  }));

  // 404 is okay, as we will create it
  if (!headResponse.ok && headResponse.status !== 404) {
    return headResponse;
  }

  const path = await getPath(request.url, options);

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

  const body = await asBuffer(request);

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

  const headers: { [key: string]: string } = {
    "Last-Modified": stat.mtime.toUTCString()
  };

  if (status === 201) {
    headers["Location"] = request.url;
  }

  return new Response(undefined, {
    status,
    statusText: options.statusCodes[status],
    headers
  });
}

export default handlePutMethod;
