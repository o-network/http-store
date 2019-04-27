import { Request, Response } from "@opennetwork/http-representation";
import fs from "fs";

/*
DELETE:

unlink

DELETE DIRECTORY:

unlink
lstat
chmod
stat
rmdir
readdir

GET

readFile

PUT

writeFile

COPY

readFile
writeFile

HEAD

// Everything does a head first, so this is required
stat
 */

export type FSRimRafOptions = {
  maxBusyTries?: number;
  emfileWait?: boolean;
  disableGlob?: boolean;
  glob?: any | false;
};

// These are all the functions we utilise
// If a method requires a specific function that isn't provided
// then the method won't be available
export type FSCompatible = {
  unlink?: typeof fs.unlink,
  lstat?: typeof fs.lstat,
  chmod?: typeof fs.chmod,
  stat: typeof fs.stat,
  rmdir?: typeof fs.rmdir,
  readdir?: typeof fs.readdir,
  readFile?: typeof fs.readFile,
  writeFile?: typeof fs.writeFile
};

export type FSStoreOptions = {
  fs: FSCompatible;
  rimraf?: ((path: string, options: FSStoreOptions & FSRimRafOptions, callback: (error: Error) => void) => void) & { noFSFunctionCheck?: boolean },
  mkdirp?: ((path: string, options: { fs: FSCompatible }, callback: (err: Error) => void) => void) & { noFSFunctionCheck?: boolean };
  rootPath?: string;
  getPath?: (url: string) => string | Promise<string>
  statusCodes: {
    [errorCode: number]: string | undefined;
    [errorCode: string]: string | undefined;
  };
  getExternalResource?: (url: string, request: Request) => Promise<Response>;
  getContentLocation?: (request: Request, getPath: (url: string) => Promise<string>) => Promise<string>;
  getPossibleSuffixes?: (request: Request, path: string) => string[] | Promise<string[]>;
  getContentTypeBody?: true | false | ((request: Request, contentLocation: string, body: Uint8Array) => string | Promise<string>);
  getContentType?: (request: Request, contentLocation: string, body?: Uint8Array) => string | Promise<string>;
  getLinkedResources?: (request: Request) => Promise<string[]>;
  createWriteLock?: (request: Request) => Promise<() => Promise<void>>;
  createReadLock?: (request: Request) => Promise<() => Promise<void>>;
  ignoreLock?: boolean;
  isWrite?: (request: Request) => boolean;
  isRead?: (request: Request) => boolean;
  fetch?: (request: Request, options: FSStoreOptions) => Promise<Response>;
};
