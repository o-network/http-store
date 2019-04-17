import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
import getPath from "../get-path";

async function handleGetMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
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
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501],
      headers: {
        Warning: "199 - Listing a directory is not yet supported"
      }
    });
  }

  const body = await new Promise(
    (resolve, reject) => options.fs.readFile(
      path,
      (error, data) => error ? reject(error) : resolve(data)
    )
  );

  return new Response(body, {
    status: 200,
    statusText: options.statusCodes[200],
    headers: headResponse.headers
  });
}

export default handleGetMethod;
