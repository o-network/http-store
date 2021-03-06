import { FSStoreOptions } from "../options";
import { Request, Response, Headers } from "@opennetwork/http-representation";
import getPath from "../get-path";
import getContentLocation from "../get-content-location";
import fs from "fs";
import { Fetcher } from "./";

async function listDirectory(request: Request, options: FSStoreOptions, path: string, contentLocation: string, stat: fs.Stats, headers: Headers): Promise<Response> {
  if (!options.fs.readdir) {
    return new Response(undefined, {
      status: 501,
      statusText: options.statusCodes[501],
      headers: {
        Warning: "199 - Cannot list directory, not all required fs methods are available"
      }
    });
  }

  const childrenNames: string[] = await new Promise(
    (resolve, reject) => options.fs.readdir(
      path,
      (error, files) => error ? reject(error) : resolve(files)
    )
  );

  const contentLocationPath = contentLocation.endsWith("/") ? contentLocation : `${contentLocation}/`;
  const children = await Promise.all(
    childrenNames
      .map(
        async name => {
          const url = `${contentLocationPath}${name}`;
          const childRequest = new Request(
            url,
            {
              method: "HEAD",
              headers: {
                "Accept": "*/*"
              }
            }
          );
          const { contentLocation, stat } = await getContentLocation(childRequest, options);
          return { contentLocation: contentLocation || url, stat };
        }
      )
  );

  const context = {
    "ldp": "http://www.w3.org/ns/ldp#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "st": "http://www.w3.org/ns/posix/stat#",
    "terms": "http://purl.org/dc/terms/",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    [contentLocation]: contentLocation
  };

  function childId({ stat, contentLocation }: { stat: fs.Stats, contentLocation: string }) {
    if (!stat.isDirectory() || contentLocation.endsWith("/")) {
      return contentLocation;
    }
    return `${contentLocation}/`;
  }

  const body = {
    "@context": context,
    "@graph": [
      {
        "@id": contentLocation,
        "@type": [
          "ldp:BasicContainer",
          "ldp:Container"
        ],
        "ldp:contains": children.map(
          child => ({
            "@id": childId(child)
          })
        ),
        "terms:modified": {
          "@type": "xsd:dateTime",
          "@value": new Date(stat.mtime).toUTCString()
        },
        "st:mtime": {
          "@type": "xsd:decimal",
          "@value": new Date(stat.mtime).getTime() / 1000
        },
        "st:size": stat.size
      } as any
    ]
      .concat(
        children.map(
          child => ({
            "@id": childId(child),
            "@type": [
              child.stat.isDirectory() ? "ldp:BasicContainer" : undefined,
              child.stat.isDirectory() ? "ldp:Container" : undefined,
              "ldp:Resource"
            ]
              .filter(value => value),
            "terms:modified": {
              "@type": "xsd:dateTime",
              "@value": new Date(child.stat.mtime).toUTCString()
            },
            "st:mtime": {
              "@type": "xsd:decimal",
              "@value": new Date(child.stat.mtime).getTime() / 1000
            },
            "st:size": child.stat.size
          })
        )
      )
  };

  const bodyString = JSON.stringify(body);

  headers.set("Content-Type", "application/ld+json");
  headers.set("Content-Length", bodyString.length.toString());

  return new Response(
    bodyString,
    {
      status: 200,
      statusText: options.statusCodes[200],
      headers
    }
  );
}

async function handleGetMethod(request: Request, options: FSStoreOptions, fetch: Fetcher): Promise<Response> {

  const { contentLocation, stat } = await getContentLocation(request, options);

  const headResponse = await fetch(
    new Request(
      contentLocation || request.url,
      {
        ...request,
        method: "HEAD"
      }
    ),
    {
      // We will be already locked here
      ignoreLock: true
    }
  );

  // Could be 416 or 404 etc
  if (!headResponse.ok) {
    return headResponse;
  }

  const headers = new Headers(headResponse.headers);

  if (contentLocation) {
    headers.set("Content-Location", contentLocation);
  }

  const path = await getPath(contentLocation || request.url, options);

  if (stat && stat.isDirectory()) {
    return listDirectory(request, options, path, contentLocation || request.url, stat, headers);
  }

  const body: Uint8Array = await new Promise(
    (resolve, reject) => options.fs.readFile(
      path,
      (error, data) => error ? reject(error) : resolve(data)
    )
  );

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
