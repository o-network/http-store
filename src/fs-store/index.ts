import Store from "../store";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions, FSStoreRequestOptions } from "./options";
import { METHODS, MethodHandler, Fetcher } from "./methods";
import { findAvailablePOSTUrl } from "./methods/post";

export {
  FSStoreOptions,
  FSStoreRequestOptions
};

class FSStore implements Store {

  private readonly options: FSStoreOptions;

  constructor(options: FSStoreOptions) {
    this.options = options;
  }

  public findAvailablePOSTUrl(baseUrl: string, options: FSStoreRequestOptions = undefined): Promise<string> {
    const newOptions = this.getOptions(options);
    const fetcher = this.getFetcher(newOptions);
    return findAvailablePOSTUrl(
      baseUrl,
      newOptions,
      fetcher
    );
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

  private getOptions(options: FSStoreRequestOptions = undefined): FSStoreOptions {
    return {
      ...this.options,
      ...(options || {})
    };
  }

  private getFetcher(options: FSStoreOptions): Fetcher {
    // When we call an external fetch, pass this fetch as the new fetch, anything invoked inside
    // will only ever use this fetch within that set
    return (request: Request) => (options.fetch || this.fetch)(request, {
      ...options,
      fetch: this.fetch
    });
  }

  readonly fetch = async (request: Request, options: FSStoreRequestOptions = undefined): Promise<Response> => {
    const handler = this.getHandler(request.method);
    if (handler) {
      const newOptions = this.getOptions(options);
      const fetcher = this.getFetcher(newOptions);
      return handler(request, newOptions, fetcher);
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
