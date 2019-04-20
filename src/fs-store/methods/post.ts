import { FSStoreOptions } from "../options";
import { asBuffer, Request, Response, Headers } from "@opennetwork/http-representation";
import handlePut from "./put";
import Multipart from "parse-multipart";
import { resolve } from "../join-path";
import isType from "../is-type";
import globalThis from "@ungap/global-this";
import getContentLocation from "../get-content-location";

async function getBody(request: Request): Promise<Uint8Array> {
  if ("Buffer" in globalThis) {
    return asBuffer(request);
  }
  const arrayBuffer = await request.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function getUrlForFile(baseRequest: Request, name: string): string {
  const url = new URL(baseRequest.url);

  // POST must be in a container for multipart
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }

  // This won't map `/../` segments
  url.pathname = resolve(url.pathname, name);

  return url.toString();
}

async function handleMultipart(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  const body: Uint8Array = await getBody(request);
  const boundary = Multipart.getBoundary(request.headers.get("Content-Type"));
  const parsed = Multipart.Parse(body, boundary);

  const requests = parsed
    .map(({ filename, type, data }) => {
      const headers = new Headers(request.headers);

      // Remove all headers related to the request entity
      Array.from(headers.keys())
        .filter(name => [
          "Content-Length",
          "Content-Type",
          // "Content-Language" This one can actually be retained, leaving here is its explicit. Language applies to content of form data
          "Content-Encoding",
          "Content-MD5",
          "Content-Range"
        ].includes(name.toLowerCase()))
        .forEach(name => headers.delete(name));

      headers.set("Content-Type", type);
      headers.set("Content-Length", data.length.toString());

      return new Request(
        getUrlForFile(request, filename),
        {
          method: "PUT",
          headers,
          body
        }
      );
    });

  if (requests.length === 1) {
    // Allow take over of the request for this single file
    return handlePut(requests[0], options, fetch);
  } else {
    const responses = await Promise.all(
      requests.map(request => handlePut(request, options, fetch))
    );
    const notOkay = responses
      .find(response => !response.ok);
    if (notOkay) {
      // One of them was not ok, so we're going to return that one
      // Other parts of the request may have succeeded
      return notOkay;
    }
  }

  return new Response(
    undefined,
    {
      status: 204,
      headers: {
        // No headers to append as we have multiple requests
      }
    }
  );
}

async function handlePostMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  if (isType(request.headers, "multipart/form-data")) {
    return handleMultipart(request, options, fetch);
  }
  const { contentLocation } = await getContentLocation(request, options);
  // Single file maps to a put
  return handlePut(
    new Request(
      contentLocation,
      {
        method: "PUT",
        headers: request.headers,
        body: request
      }
    ),
    options,
    fetch
  );
}

export default handlePostMethod;
