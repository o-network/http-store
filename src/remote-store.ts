import { Request, Response } from "@opennetwork/http-representation";
import Store from "./store";

export type Fetcher = (request: Request) => Promise<Response>;

class RemoteStore implements Store {

  private readonly fetcher: Fetcher;

  constructor(fetch: Fetcher) {
    this.fetcher = fetch;
  }

  fetch = async (request: Request): Promise<Response> => {
    return this.fetcher(request);
  };
}

export default RemoteStore;
