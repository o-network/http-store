import { promisify } from "util";
import fs from "fs";
import { Request } from "@opennetwork/http-representation";

async function fsStat(path) {
  return promisify(fs.stat)(path)
    .catch(() => undefined);
}

export default async (request, response, stat, store) => {
  let links = [];

  if (stat.isDirectory()) {
    links.push(["type", "http://www.w3.org/ns/ldp#BasicContainer"]);
  } else if (stat.isFile()) {
    links.push(["type", "http://www.w3.org/ns/ldp#Resource"]);
  }

  const contentLocation = response.headers.get("Content-Location");

  async function getLinksForURL(url) {
    const forUrl = [];

    if (!url) {
      return forUrl;
    }

    const urlInstance = new URL(url);
    urlInstance.hash = "";
    urlInstance.search = "";

    const aclUrl = new URL(urlInstance.toString());
    aclUrl.pathname += ".acl";

    const metaUrl = new URL(urlInstance.toString());
    metaUrl.pathname += ".meta";

    const aclHead = await store.fetch(
      new Request(
        aclUrl.toString(),
        {
          method: "HEAD",
          headers: {
            "Content-Type": "text/turtle"
          }
        }
      )
    );
    const metaHead = await store.fetch(
      new Request(
        metaUrl.toString(),
        {
          method: "HEAD",
          headers: {
            "Content-Type": "text/turtle"
          }
        }
      )
    );

    if (aclHead.ok) {
      forUrl.push(["acl", aclUrl.toString()])
    }

    if (metaHead.ok) {
      forUrl.push(["describedBy", metaUrl.toString()])
    }

    return forUrl;
  }

  const [forCurrent, forContentLocation] = await Promise.all([
    getLinksForURL(request.url),
    getLinksForURL(contentLocation)
  ]);

  if (forCurrent.length) {
    links = links.concat(forCurrent);
  } else if (forContentLocation.length) {
    links = links.concat(forContentLocation);
  }

  return links;
};
