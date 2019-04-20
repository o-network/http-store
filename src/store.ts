import { Request, Response } from "@opennetwork/http-representation";

export type Fetcher = (request: Request, options?: any) => Promise<Response>;

export interface Store {
  fetch: Fetcher;
}
