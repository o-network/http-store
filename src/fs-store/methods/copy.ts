import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";

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
  if (source.startsWith(".") || source.startsWith("/")) {
    sourceResponse = await fetch(new Request(source, {
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
