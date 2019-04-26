import { Request, asBuffer } from "@opennetwork/http-representation";
import { FSStore } from "../dist";
import fs from "fs";
import http from "http";
import assert from "assert";
import { mkdirp } from "fs-extra";
import rimraf from "rimraf";
import { lookup } from "mime-types";
import getContentLocation from "./get-content-location";

async function runExample(store) {
  const documentUrl = "https://store.open-network.app/example/document";
  const documentContent = Buffer.from("test", "utf-8");

  const putResponse = await store.fetch(
      new Request(
          documentUrl,
          {
              method: "PUT",
              body: documentContent,
              headers: {
                  "Content-Type": "text/plain"
              }
          }
      )
  );

  assert(putResponse.ok);

  const getResponse = await store.fetch(
      new Request(
          documentUrl,
          {
              method: "GET",
              headers: {
                  "Accept": "text-plain"
              }
          }
      )
  );

  assert(getResponse.ok);

  console.log(getResponse.headers);

  assert(getResponse.headers.get("Content-Type") === "text/plain");

  const body = await asBuffer(getResponse);

  assert(body instanceof Uint8Array);
  assert(body.toString() === documentContent.toString());
}

const getContentType = request => {
  if (request.method !== "HEAD" && request.method !== "GET") {
    return undefined; // No content
  }
  // Provided content type already
  if (request.headers.get("Content-Type")) {
    return request.headers.get("Content-Type");
  }
  return lookup(new URL(request.url).pathname)
};

runExample(
  new FSStore({
    fs,
    rootPath: "./store",
    statusCodes: http.STATUS_CODES,
    mkdirp,
    rimraf,
    getContentType,
    getContentLocation
  })
)
    .then(() => console.log("Complete!"))
    .catch((error) => console.error("Received error!", error));
