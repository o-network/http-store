import Store from "../store";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions } from "./options";
import { METHODS } from "./methods";

export {
  FSStoreOptions
};

class FSStore implements Store {

    private readonly options: FSStoreOptions;

    constructor(options: FSStoreOptions) {
      this.options = options;
    }

    async fetch(request: Request): Promise<Response> {
      const handler = METHODS[request.method.toUpperCase()];
      if (!handler) {
        return new Response(undefined, {
          status: 405,
          statusText: this.options.statusCodes[405],
          headers: {
            Allow: Object.keys(METHODS).join(", ")
          }
        });
      }
      return handler(request, this.options, this.fetch);
    }

}

export default FSStore;
