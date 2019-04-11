import Store from "../store";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions } from "./options";
import { METHODS, MethodHandler } from "./methods";

export {
  FSStoreOptions
};

class FSStore implements Store {

    private readonly options: FSStoreOptions;

    constructor(options: FSStoreOptions) {
      this.options = options;
    }

    private isMethodAvailable(method: String): boolean {
      const upper = method.toUpperCase();
      if (!METHODS[upper]) {
        return false;
      }
      const requiredFS: string[] = ({
        DELETE: [
          "stat",
          "unlink"
        ],
        HEAD: [
          "stat"
        ],
        GET: [
          "stat",
          "readFile"
        ],
        PUT: [
          "stat",
          "writeFile"
        ],
        COPY: [
          "stat",
          "readFile",
          "writeFile"
        ]
      } as any)[method.toUpperCase()];

      if (!(requiredFS && requiredFS.length)) {
        // No specific requirement, so return true
        return true;
      }
      const missing = requiredFS.findIndex(
        name => !((this.options.fs as any)[name] instanceof Function)
      );
      return missing === -1;
    }

    private getHandler(method: String): MethodHandler {
      const handler = METHODS[method.toUpperCase()];
      return this.isMethodAvailable(method) ? handler : undefined;
    }

    readonly fetch = async (request: Request): Promise<Response> => {
      const handler = this.getHandler(request.method);
      if (handler) {
        return handler(request, this.options, this.fetch);
      }
      return new Response(undefined, {
        status: 405,
        statusText: this.options.statusCodes[405],
        headers: {
          Allow: Object.keys(METHODS).filter(method => this.isMethodAvailable(method)).join(", ")
        }
      });
    }

}

export default FSStore;
