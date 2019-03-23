# Open Network HTTP Store

This module aims to provide a common way to access files over HTTP, the underlying store may
communicate over different transports, while adopting the HTTP specification. 

## Installation

Currently we have only distributed this module via [npm](https://www.npmjs.com/package/@opennetwork/http-store) using
the package name `@opennetwork/http-store`

This module relies on `@opennetwork/http-representation` as a peer dependency which is also distributed via [npm](https://www.npmjs.com/package/@opennetwork/http-representation)

### Installation via the npm CLI

#### Using the module directly

```bash
npm install --save @opennetwork/http-representation @opennetwork/http-store
```

#### Using the module within another module

```bash
npm install --save-dev @opennetwork/http-representation @opennetwork/http-store
```

Once you have added the module to your `devDependencies`, include the module
in your `peerDependencies` so the same version is used across the stack.

## Usage

### FS Store

To utilise the `FSStore` you need to instantiate an instance using some options, this is via a single object

This is the type definition for the options:

```ts
type FSStoreOptions = {
  fs: typeof fs;
  rootPath?: string;
  getPath?: (url: string) => string | Promise<string>
  statusCodes: {
    [errorCode: number]: string | undefined;
    [errorCode: string]: string | undefined;
  };
  getExternalResource?: (url: string, request: Request) => Promise<Response>
};
```

- `fs`, an instance of `fs`, this could be either the Node.js implementation of [`fs`](https://nodejs.org/api/fs.html), or a compatible module like [hyperdrive](https://www.npmjs.com/package/hyperdrive) (Required)
- `rootPath`, the root path where we are going to store & read files from (Required if `getPath` is not present)
- `getPath`, a function that can map the received url's to a path within the file system (Required if `rootPath` is not present)
- `statusCodes`, an object containing all available status codes, this could be the Node.js module `http` via [`http.STATUS_CODES`](https://nodejs.org/api/http.html#http_http_status_codes)
- `getExternalResource`, a function that can resolve external dependencies, this is used for `COPY` requests when the resource is external, if not provided the status `501 - Not Implemented` will be returned to the consumer

#### Example

```ts
import { Request } from "@opennetwork/http-representation";
import { FSStore, Store } from "@opennetwork/http-store";
import fs from "fs";
import http from "http";
import assert from "assert";

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

```





