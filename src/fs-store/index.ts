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

    readonly fetch = async (request: Request): Promise<Response> => {
      const handler = METHODS[request.method.toUpperCase()];
      if (handler) {
        return handler(request, this.options, this.fetch);
      }
      return new Response(undefined, {
        status: 405,
        statusText: this.options.statusCodes[405],
        headers: {
          Allow: Object.keys(METHODS).join(", ")
        }
      });
    }

}

export default FSStore;
