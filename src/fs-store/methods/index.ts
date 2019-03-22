import handleCopy from "./copy";
import handleDelete from "./delete";
import handleGet from "./get";
import handleHead from "./head";
import handleOptions from "./options";
import handlePut from "./put";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions } from "../options";

export type Fetcher = (request: Request) => Promise<Response>;
export type MethodHandler = (request: Request, options: FSStoreOptions, fetch: Fetcher) => Promise<Response>;

export {
  handleCopy,
  handleDelete,
  handleGet,
  handleHead,
  handleOptions,
  handlePut
};

export const METHODS: { [key: string /* RequestMethod */]: MethodHandler } = {
  COPY: handleCopy,
  DELETE: handleDelete,
  GET: handleGet,
  HEAD: handleHead,
  OPTIONS: handleOptions,
  PUT: handlePut
};
