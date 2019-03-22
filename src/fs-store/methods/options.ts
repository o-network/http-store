import { FSStoreOptions } from "../options";
import { Request, Response } from "@opennetwork/http-representation";

async function handleMethod(request: Request, options: FSStoreOptions): Promise<Response> {
  // Nothing to do, CORS etc will be handled by a level above
  return new Response(undefined, {
    status: 200,
    statusText: options.statusCodes[200]
  });
}

export default handleMethod;
