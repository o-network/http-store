import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";
import promisify from "es6-promisify";
import getPath from "../get-path";

async function handleMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
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

  await (promisify as any)(options.fs.writeFile)(
    path,
    request.body
  );

  const stat = await (promisify as any)(options.fs.stat)(path)
    .catch((): undefined => undefined);

  if (!stat) {
    return new Response(undefined, {
      status: 500,
      statusText: options.statusCodes[500],
      headers: {
        Warning: "199 - Could not save file"
      }
    });
  }

  const status = headResponse.status === 404 ? 201 : 204;
  return new Response(undefined, {
    status,
    statusText: options.statusCodes[status],
    headers: {
      "Location": request.url,
      "Last-Modified": stat.mtime.toUTCString()
    }
  });
}

export default handleMethod;
