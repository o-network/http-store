import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
import promisify from "es6-promisify";
import getPath from "../get-path";

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

  const body = await (promisify as any)(options.fs.readFile)(
    await getPath(request.url, options)
  );

  return new Response(body, {
    status: 200,
    statusText: options.statusCodes[200],
    headers: headResponse.headers
  });
}

export default handleMethod;
