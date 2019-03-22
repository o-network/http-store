import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
import { promisify } from "es6-promisify";
import getPath from "../get-path";
import rimraf from "rimraf";

async function handleMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  const headResponse = await fetch(
    new Request(
      request.url,
      {
        ...request,
        method: "HEAD"
      }
    )
  );

  // Could be 416 or 404 etc
  if (!headResponse.ok) {
    return headResponse;
  }

  const path = await getPath(request.url, options);

  if (path.endsWith("/")) {
    // Directory
    await (rimraf as any)(path, options.fs);
  } else {
    // File
    await promisify(options.fs.unlink)(path, undefined);
  }

  return new Response(undefined, {
    status: 204,
    statusText: options.statusCodes[204]
  });
}

export default handleMethod;
