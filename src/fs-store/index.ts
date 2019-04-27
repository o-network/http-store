import { Store } from "../store";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions } from "./options";
import { METHODS, MethodHandler, Fetcher } from "./methods";
import getContentLocation from "./get-content-location";
import getPath from "./get-path";
import { Partial } from "../partial";

export {
  getContentLocation,
  getPath
};

export * from "./options";

export class FSStore implements Store {

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
      ],
      // Same as PUT
      POST: [
        "stat",
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

  private getOptions(options: Partial<FSStoreOptions> = undefined): FSStoreOptions {
    return {
      createWriteLock: async () => () => Promise.resolve(),
      createReadLock: async () => () => Promise.resolve(),
      ...this.options,
      ...(options || {})
    };
  }

  private getFetcher(options: FSStoreOptions): Fetcher {
    // When we call an external fetch, pass this fetch as the new fetch, anything invoked inside
    // will only ever use this fetch within that set
    return (request: Request, nextOptions?: FSStoreOptions) => (options.fetch || this.fetch)(request, {
      ...options,
      ...nextOptions,
      fetch: this.fetch
    });
  }

  private async fetchLocked(request: Request, handler: MethodHandler, options: FSStoreOptions): Promise<Response> {
    const fetcher = this.getFetcher(options);
    return handler(request, options, fetcher);
  }

  private static isWrite(request: Request, options: FSStoreOptions): boolean {
    if (options.isWrite) {
      return options.isWrite(request);
    }
    const writeMethods = ["POST", "PUT", "COPY", "DELETE"];
    return writeMethods.includes(request.method.toUpperCase());
  }

  private static isRead(request: Request, options: FSStoreOptions): boolean {
    if (options.isRead) {
      return options.isRead(request);
    }
    const readMethods = ["GET", "HEAD"];
    return readMethods.includes(request.method.toUpperCase());
  }

  private async lock(request: Request, options: FSStoreOptions): Promise<() => Promise<void>> {
    const def = async () => {};
    if (options.ignoreLock) {
      return def;
    }
    if (FSStore.isWrite(request, options)) {
      if (!options.createWriteLock) {
        return def;
      }
      return options.createWriteLock(request)
        .then(lock => lock || def);
    }
    if (FSStore.isRead(request, options)) {
      if (!options.createReadLock) {
        return def;
      }
      return options.createReadLock(request)
        .then(lock => lock || def);
    }
    return def;
  }

  readonly fetch = async (request: Request, options: Partial<FSStoreOptions> = undefined): Promise<Response> => {
    const handler = this.getHandler(request.method);
    if (!handler) {
      return new Response(undefined, {
        status: 405,
        statusText: this.options.statusCodes[405],
        headers: {
          Allow: Object.keys(METHODS).filter(method => this.isMethodAvailable(method)).join(", ")
        }
      });
    }
    const newOptions = this.getOptions(options);
    const unlock = await this.lock(request, newOptions);
    try {
      return this.fetchLocked(request, handler, newOptions);
    } finally {
      await unlock();
    }
  }

}
