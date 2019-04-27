import { FSStoreOptions } from "../options";
import { Request, Response, Headers, asBuffer } from "@opennetwork/http-representation";
import getPath from "../get-path";
import { resolve } from "../join-path";
import getContentLocation from "../get-content-location";
import { Fetcher } from "./";

function getSourceURI(destinationUrl: string, source: string): string {
  const destination = new URL(destinationUrl);
  if (/^(?:[a-z0-9-_]+:|\/)/i.test(source)) {
    // Absolute url with schema, or absolute path
    return new URL(source, destination.origin).toString();
  }

  const destinationDirectory = destination.pathname.substr(0, destination.pathname.lastIndexOf("/")) + "/";
  return new URL(
    resolve(destinationDirectory, source),
    destination.origin
  ).toString();
}

async function handleCopyMethod(request: Request, options: FSStoreOptions, fetch: Fetcher): Promise<Response> {
  const { contentLocation } = await getContentLocation(request, options);

  const source = request.headers.get("Source");

  if (!source) {
    return new Response(undefined, {
      status: 400,
      statusText: options.statusCodes[400],
      headers: {
        Warning: "199 - Source header missing"
      }
    });
  }

  let sourceResponse: Response;

  const destinationPath = await getPath(contentLocation || request.url, options);

  const isLocal = source.startsWith(".") || source.startsWith("/");

  if (isLocal && (source.endsWith("/") !== destinationPath.endsWith("/"))) {
    return new Response(undefined, {
      status: 400,
      statusText: options.statusCodes[400],
      headers: {
        Warning: "199 - Cannot move folder to file and vise-versa"
      }
    });
  } if (isLocal && source.endsWith("/") && destinationPath.endsWith("/")) {
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501],
      headers: {
        Warning: "199 - COPY on a directory is not yet supported"
      }
    });
  } else if (isLocal) {
    sourceResponse = await fetch(new Request(getSourceURI(request.url, source), {
      headers: new Headers(request.headers),
      method: "GET"
    }), { ignoreLock: true });
  } else if (!options.getExternalResource) {
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501]
    });
  } else {
    sourceResponse = await options.getExternalResource(source, request);
  }

  // Could be 404
  if (!sourceResponse.ok) {
    return sourceResponse;
  }

  const requestHeaders = new Headers(request.headers);

  const reset: string[] = [];

  sourceResponse.headers.forEach(
    (value, key) => {
      if (!/^Content-/i.test(key)) {
        return;
      }
      if (!reset.includes(key)) {
        requestHeaders.delete(key);
        reset.push(key);
      }
      requestHeaders.append(key, value);
    }
  );

  const response = await fetch(new Request(request.url, {
    body: await asBuffer(sourceResponse),
    headers: request.headers,
    method: "PUT"
  }), { ignoreLock: true });

  if (!response.ok) {
    return response;
  }

  return new Response(undefined, {
    status: 201,
    statusText: options.statusCodes[201],
    headers: {
      Location: request.url
    }
  });
}

export default handleCopyMethod;
