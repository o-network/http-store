import { FSStoreOptions } from "./options";
import { joinWithRoot } from "./join-path";

export default async (urlString: string, options: FSStoreOptions): Promise<string> => {
  const contentLocation = urlString;
  if (options.getPath) {
    return options.getPath(contentLocation);
  }
  if (!options.rootPath) {
    throw new Error("One of rootPath or getPath is required");
  }
  const url = new URL(contentLocation, "https://default");
  return joinWithRoot(options.rootPath, url.pathname);
};
