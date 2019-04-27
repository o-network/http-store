import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
import getPath from "../get-path";
import getContentLocation from "../get-content-location";
import { Fetcher } from "./";
import li from "li";

function isRimRafAvailable(options: FSStoreOptions): boolean {
  if (!options.rimraf) {
    return false;
  }
  // They requested to not check for rimraf functions, so they must have their own implementation
  if (options.rimraf.noFSFunctionCheck) {
    return true;
  }
  const required = [
    "unlink",
    "lstat",
    "chmod",
    "stat",
    "rmdir",
    "readdir"
  ];
  const missing = required.findIndex(name => !((options.fs as any)[name] instanceof Function));
  return missing === -1;
}

async function deleteDependentLinks(request: Request, options: FSStoreOptions, headResponse: Response, fetch: Fetcher) {
  if (!options.isLinkedDependent) {
    return;
  }
  const links = li.parse(headResponse.headers.getAll("Link").join(", "));
  return await Promise.all(
    Object.keys(links)
      .filter(rel => options.isLinkedDependent(request, rel, links[rel]))
      .map(rel => links[rel])
      .map(
        async url => fetch(
          new Request(
            url,
            {
              method: "DELETE",
              headers: request.headers
            }
          )
        )
      )
  );
}

async function handleDeleteMethod(request: Request, options: FSStoreOptions, fetch: Fetcher): Promise<Response> {
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

  // Could be 416 or 404 etc
  if (!headResponse.ok) {
    return headResponse;
  }

  const path = await getPath(contentLocation || request.url, options);

  if (path.endsWith("/")) {
    // Directory
    if (!isRimRafAvailable(options)) {
      return new Response(undefined, {
        status: 501,
        statusText: options.statusCodes[501],
        headers: {
          Warning: "199 - Cannot delete directory, not all required fs methods are available"
        }
      });
    }
    // rimraf mutates the options provided, so create a new object
    await (options.rimraf as any)(path, {
      unlink: options.fs.unlink,
      lstat: options.fs.lstat,
      chmod: options.fs.chmod,
      stat: options.fs.stat,
      rmdir: options.fs.rmdir,
      readdir: options.fs.readdir,
    });
  } else {
    // File
    await new Promise(
      (resolve, reject) => options.fs.unlink(
        path,
        (error) => error ? reject(error) : resolve()
      )
    );
  }

  await deleteDependentLinks(request, options, headResponse, fetch);

  return new Response(undefined, {
    status: 204,
    statusText: options.statusCodes[204]
  });
}

export default handleDeleteMethod;
