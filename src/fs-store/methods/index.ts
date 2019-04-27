import handleCopy from "./copy";
import handleDelete from "./delete";
import handleGet from "./get";
import handleHead from "./head";
import handleOptions from "./options";
import handlePost from "./post";
import handlePut from "./put";
import { Request, Response } from "@opennetwork/http-representation";
import { FSStoreOptions } from "../options";
import { Partial } from "../../partial";

export type Fetcher = (request: Request, options?: Partial<FSStoreOptions>) => Promise<Response>;
export type MethodHandler = (request: Request, options: FSStoreOptions, fetch: Fetcher) => Promise<Response>;

export {
  handleCopy,
  handleDelete,
  handleGet,
  handleHead,
  handleOptions,
  handlePost,
  handlePut
};

export const METHODS: { [key: string /* RequestMethod */]: MethodHandler } = {
  COPY: handleCopy,
  DELETE: handleDelete,
  GET: handleGet,
  HEAD: handleHead,
  OPTIONS: handleOptions,
  POST: handlePost,
  PUT: handlePut
};
