import { Request, Response } from "@opennetwork/http-representation";
import { Store, Fetcher } from "./store";

export class RemoteStore implements Store {

  private readonly fetcher: Fetcher;

  constructor(fetch: Fetcher) {
    this.fetcher = fetch;
  }

  fetch = async (request: Request, options?: any): Promise<Response> => {
    return this.fetcher(request, options);
  };
}
