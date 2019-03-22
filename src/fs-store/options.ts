import fs from "fs";
import { Request, Response } from "@opennetwork/http-representation";

export type FSStoreOptions = {
  fs: typeof fs;
  rootPath?: string;
  getPath?: (url: string) => string | Promise<string>
  statusCodes: {
    [errorCode: number]: string | undefined;
    [errorCode: string]: string | undefined;
  };
  getExternalResource?: (url: string, request: Request) => Promise<Response>
};
