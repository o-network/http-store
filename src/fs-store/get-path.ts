import { FSStoreOptions } from "./options";
import join from "join-path";

export default async (urlString: string, options: FSStoreOptions): Promise<string> => {
  if (options.getPath) {
    return options.getPath(urlString);
  }
  if (!options.rootPath) {
    throw new Error("One of rootPath or getPath is required");
  }
  const url = new URL(urlString, "https://default");
  return join(options.rootPath, url.pathname);
};
