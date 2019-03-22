import { Request, Response } from "@opennetwork/http-representation";

export default interface Store {
  fetch(request: Request): Promise<Response>;
}
