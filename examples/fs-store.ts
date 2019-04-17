import { asBuffer, Request } from "@opennetwork/http-representation";
import { FSStore, Store } from "../src";
import fs from "fs";
import http from "http";
import assert from "assert";
import { mkdirp } from "fs-extra";
import rimraf from "rimraf";

async function runExample(store: Store) {

    const documentUrl = "https://store.open-network.app/example/document.txt";
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

    const body = await asBuffer(getResponse);

    assert(body instanceof Uint8Array);
    assert(body.toString() === documentContent.toString());
}

runExample(
    new FSStore({
        fs,
        rootPath: "./store",
        statusCodes: http.STATUS_CODES,
        mkdirp,
        rimraf
    })
)
    .then(() => console.log("Complete!"))
    .catch((error) => console.error("Received error!", error));