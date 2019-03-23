import { Request } from "@opennetwork/http-representation";
import { FSStore } from "../dist";
import fs from "fs";
import http from "http";
import assert from "assert";

async function runExample(store) {

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

    assert(getResponse.ok);

    assert(getResponse.body instanceof Uint8Array);
    assert(getResponse.body.toString() === documentContent.toString());
}

runExample(
    new FSStore({
        fs,
        rootPath: "./store",
        statusCodes: http.STATUS_CODES
    })
)
    .then(() => console.log("Complete!"))
    .catch((error) => console.error("Received error!", error));
