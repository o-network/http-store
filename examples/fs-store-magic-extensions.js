import { Request, asBuffer } from "@opennetwork/http-representation";
import { FSStore } from "../dist";
import fs from "fs";
import http from "http";
import assert from "assert";
import { mkdirp } from "fs-extra";
import rimraf from "rimraf";
import { lookup, extension } from "mime-types";
import { dirname, basename, extname } from "path";
import Negotiator from "negotiator";

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
    getContentLocation: async (request, getPath) => {
      const magicExtensionRegex = /\$\.[^.]+/i;

      const url = new URL(request.url);

      if (request.method === "PUT" && magicExtensionRegex.test(url.pathname)) {
        // The user has requested to use a magic extension directly
        return undefined;
      }

      const path = await getPath(request.url);

      async function stat(path) {
        return new Promise(
          resolve => fs.stat(
            path,
            (error, stat) => resolve(error ? undefined : stat)
          )
        );
      }

      const pathStat = await stat(path);

      if (pathStat && pathStat.isFile()) {
        // Is already correct and we can continue on
        return undefined;
      }

      const providedType = (request.headers.get("Content-Type") || "").split(";")[0].trim();
      const extensionType = lookup(url.pathname);

      if (request.method === "PUT" && extensionType && providedType && extensionType === providedType) {
        return undefined;
      }

      if (request.method === "PUT") {
        url.pathname += `$.${(extensionType || providedType) ? extension(extensionType || providedType) : "unknown"}`;
        return url.toString();
      }

      const directory = dirname(path);

      const directoryStat = await stat(directory);

      if (!directoryStat || !directoryStat.isDirectory()) {
        console.log({ directory, directoryStat });
        return undefined;
      }

      const files = await new Promise(
        (resolve, reject) => fs.readdir(
          directory,
          {
            encoding: "utf-8",
            withFileTypes: true
          },
          (error, files) => error ? reject(error) : resolve(files)
        )
      );

      const baseName = basename(path, extname(path));

      const matching = files
        .filter(file => file.isFile())
        .filter(file => magicExtensionRegex.test(file.name))
        .filter(file => file.name.replace(magicExtensionRegex, "") === baseName)
        .map(file => file.name);

      if (matching.length === 0) {
        return undefined;
      }

      if (matching.length === 1) {
        // Magic extension found! No further content negotiation needed
        url.pathname += `$${extname(matching[0])}`;
        return url.toString();
      }

      const headers = {
        accept: request.headers.has("accept") ? request.headers.getAll("accept").join(",") : undefined
      };

      const matchingWithContentType = matching
        .map(file => [
          file,
          lookup(file)
        ]);

      const contentTypes = matchingWithContentType.map(values => values[1]);

      const negotiator = new Negotiator({ headers });
      const preferredContentType = negotiator.mediaTypes(contentTypes);

      console.log({ matchingWithContentType, contentTypes, preferredContentType });

      if (!preferredContentType) {
        // Use the first found, there is no preferred
        return matching[0];
      }

      const matched = matchingWithContentType
        .find(value => value[1] === preferredContentType);

      const toUse = matched ? matched[0] : matching[0];
      url.pathname += `$${extname(toUse)}`;
      return url.toString();
    }
  })
)
    .then(() => console.log("Complete!"))
    .catch((error) => console.error("Received error!", error));
