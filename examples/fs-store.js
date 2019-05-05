import { Request, asBuffer } from "@opennetwork/http-representation";
import { FSStore } from "../dist";
import http from "http";
import assert from "assert";
import { mkdirp } from "fs-extra";
import rimraf from "rimraf";
import { lookup } from "mime-types";
import getContentLocation from "./get-content-location";
import getLinks from "./get-links";
import li from "li";
import dat from "dat-node";

dat("./store/", { indexing: false }, (error, dat) => {
  if (error) {
    return console.error(error);
  }

  async function runExample(store) {
    const directory = "https://store.open-network.app/example";
    const documentUrl = `${directory}/document.txt`;
    const documentContent = Buffer.from("test", "utf-8");

    const putIndexResponse = await store.fetch(
      new Request(
        `${directory}/index.html`,
        {
          method: "PUT",
          body: "<!DOCTYPE html><html><body><p>Hello!</p></body></html>\n",
          headers: {
            "Content-Type": "text/html"
          }
        }
      )
    );

    assert(putIndexResponse.ok);

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

    const listResponse = await store.fetch(
      new Request(
        `${directory}/`,
        {
          method: "GET",
          headers: {
            "Accept": "application/ld+json"
          }
        }
      )
    );

    const listLinks = li.parse(listResponse.headers.get("Link"));

    assert(listLinks["type"] === "http://www.w3.org/ns/ldp#BasicContainer");

    const documents = await listResponse.json();

    assert(documents["@graph"].find(({ "@id": id }) => id === "https://store.open-network.app/example/document.txt"));
    assert(documents["@graph"].find(({ "@id": id }) => id === "https://store.open-network.app/example/index.html"));

    const indexResponse = await store.fetch(
      new Request(
        `${directory}/`,
        {
          method: "GET",
          headers: {
            "Accept": "text/html"
          }
        }
      )
    );

    assert((await indexResponse.text()).includes("<!DOCTYPE html>"));

    const putAclResponse = await store.fetch(
      new Request(
        `${documentUrl}.acl`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle"
          },
          body: ""
        }
      )
    );

    assert(putAclResponse.ok);

    const getResponse = await store.fetch(
      new Request(
        documentUrl,
        {
          method: "GET",
          headers: {
            "Accept": "text/plain"
          }
        }
      )
    );

    assert(getResponse.ok);

    assert(getResponse.headers.get("Content-Type") === "text/plain");

    const links = li.parse(getResponse.headers.get("Link"));

    assert(links["type"] === "http://www.w3.org/ns/ldp#Resource");
    assert(links["acl"] === `${documentUrl}.acl`);

    const body = await asBuffer(getResponse);

    assert(body instanceof Uint8Array);
    assert(body.toString() === documentContent.toString());

    const deleteResponse = await store.fetch(
      new Request(
        documentUrl,
        {
          method: "DELETE"
        }
      )
    );

    assert(deleteResponse.ok);

    const [getAfterDeleteResponse, getACLAfterDeleteResponse] = await Promise.all([
      store.fetch(
        new Request(
          documentUrl,
          {
            method: "GET",
            headers: {
              "Accept": "text/plain"
            }
          }
        )
      ),
      store.fetch(
        new Request(
          `${documentUrl}.acl`,
          {
            method: "GET",
            headers: {
              "Accept": "text/turtle"
            }
          }
        )
      )
    ]);

    assert(getAfterDeleteResponse.status === 404);
    assert(getACLAfterDeleteResponse.status === 404);

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

  dat.joinNetwork();

  const options = {
    fs: dat.archive,
    rootPath: "./",
    statusCodes: http.STATUS_CODES,
    mkdirp,
    rimraf,
    getContentType,
    getContentLocation: getContentLocation(dat.archive),
    isLinkedDependent: (request, rel, value) => (
      [
        "acl",
        "describedBy"
      ].includes(rel)
    ),
    getLinks: (request, response, stat) => getLinks(request, response, stat, store)
  };

  const store = new FSStore(options);

  runExample(store)
    .then(() => console.log("Complete!"))
    .catch((error) => console.error("Received error!", error, error.stack))
    .then(() => {
      dat.close(() => process.exit(0));
    })

});
