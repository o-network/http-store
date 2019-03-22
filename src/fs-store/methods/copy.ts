import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";
import join from "join-path";
import getPath from "../get-path";
import ncp from "ncp";

async function handleMethod(request: Request, options: FSStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
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

  const destinationPath = await getPath(request.url, options);

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
    sourceResponse = await fetch(new Request(`file:${join(destinationPath, source)}`, {
      headers: new Headers(request.headers),
      method: "GET"
    }));
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
    body: (sourceResponse.body as Uint8Array),
    headers: request.headers,
    method: "PUT"
  }));

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

export default handleMethod;
