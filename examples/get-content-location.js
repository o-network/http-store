import { extension, lookup } from "mime-types";
import { dirname, extname } from "path";
import Negotiator from "negotiator";
import UUID from "pure-uuid";

async function stat(fs, path) {
  return new Promise(
    resolve => fs.stat(
      path,
      (error, stat) => resolve(error ? undefined : stat)
    )
  );
}

export default (fs) => async function getContentLocation(request, getPath) {
  const magicExtensionRegex = /\$\.[^.]+/i;

  const url = new URL(request.url);

  if (url.pathname.endsWith(".acl") || url.pathname.endsWith(".meta")) {
    return undefined; // Good to go
  }

  if (request.method === "POST") {

    // Must be a container
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }

    url.pathname += new UUID(4).format("std");

    const path = await getPath(url.toString());
    const pathStat = await stat(fs, path);

    if (pathStat && pathStat.isDirectory()) {
      // Loop around, we need to select another
      return getContentLocation(request, getPath);
    }

    return url.toString();
  }

  if (request.method === "PUT" && magicExtensionRegex.test(url.pathname)) {
    // The user has requested to use a magic extension directly
    return undefined;
  }

  const path = await getPath(request.url);

  const pathStat = await stat(fs, path);

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

  const isPathDirectory = pathStat && pathStat.isDirectory();

  const directory = isPathDirectory ? path : dirname(path);

  const directoryStat = isPathDirectory ? pathStat : await stat(fs, directory);

  if (!(directoryStat && directoryStat.isDirectory())) {
    return undefined;
  }

  const baseName = url.pathname.substr(url.pathname.lastIndexOf("/") + 1);

  const headers = {
    accept: request.headers.has("accept") ? request.headers.getAll("accept").join(",") : undefined
  };

  const negotiator = new Negotiator({ headers });

  if (isPathDirectory && negotiator.mediaType(["text/html"])) {
    const indexPath = `${path.replace(/\/$/, "")}/index.html`;
    const indexStat = await stat(fs, indexPath);
    if (!(indexStat && indexStat.isFile())) {
      return undefined;
    }
    url.pathname = `${url.pathname.replace(/\/$/, "")}/index.html`;
    return url.toString();
  }

  const files = await new Promise(
    (resolve, reject) => fs.readdir(
      directory,
      (error, files) => error ? reject(error) : resolve(files)
    )
  );

  const matching = (
    await Promise.all(
      files
        .filter(file => magicExtensionRegex.test(file))
        .filter(file => file.replace(magicExtensionRegex, "") === baseName)
        .map(async file => {
          const fileStat = await stat(`${directory}/${file}`);
          return fileStat && fileStat.isFile() ? file : undefined
        })
    )
  )
    .filter(value => value);

  if (isPathDirectory && matching.length === 0) {
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  }

  if (matching.length === 1) {
    // Magic extension found! No further content negotiation needed
    url.pathname += `$${extname(matching[0])}`;
    return url.toString();
  }

  const matchingWithContentType = matching
    .map(file => [
      file,
      lookup(file)
    ]);

  const contentTypes = matchingWithContentType.map(values => values[1]);
  const preferredContentType = negotiator.mediaTypes(contentTypes);

  if (!preferredContentType) {
    // Use the first found, there is no preferred
    return matching[0];
  }

  const matched = matchingWithContentType
    .find(value => value[1] === preferredContentType);

  const toUse = matched ? matched[0] : matching[0];
  if (!toUse) {
    return undefined;
  }
  url.pathname += `$${extname(toUse)}`;
  return url.toString();
};
