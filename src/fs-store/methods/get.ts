import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";
import getPath from "../get-path";
import getContentLocation from "../get-content-location";

async function handleGetMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  const { contentLocation } = await getContentLocation(request, options);

  const headResponse = await fetch(
    new Request(
      contentLocation || request.url,
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

  const path = await getPath(contentLocation || request.url, options);

  if (path.endsWith("/")) {
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501],
      headers: {
        Warning: "199 - Listing a directory is not yet supported"
      }
    });
  }

  const body: Uint8Array = await new Promise(
    (resolve, reject) => options.fs.readFile(
      path,
      (error, data) => error ? reject(error) : resolve(data)
    )
  );

  const headers = new Headers(headResponse.headers);

  if (contentLocation) {
    headers.set("Content-Location", contentLocation);
  }

  if (options.getContentTypeBody === true || options.getContentTypeBody instanceof Function || (options.getContentTypeBody !== false && options.getContentType)) {
    /*
    Allow to update content type further.
    Content-Type will default back to the content-type returned from the HEAD request, this will allow expanding
    parameters once the body is known.

    The implementor could check to see if body is included or not to just return undefined if they don't want to
    update by checking if the body is falsy
     */
    const fn = options.getContentTypeBody instanceof Function ? options.getContentTypeBody : options.getContentType;
    const contentType = await fn(request, headResponse.headers.get("Content-Location"), body);
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
  }

  return new Response(body, {
    status: 200,
    statusText: options.statusCodes[200],
    headers
  });
}

export default handleGetMethod;
