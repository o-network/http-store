import { Request } from "@opennetwork/http-representation";
import { FSStoreOptions } from "./options";
import fs from "fs";
import getPath from "./get-path";

export default async function getContentLocation(request: Request, options: FSStoreOptions): Promise<{ contentLocation?: string, stat: fs.Stats }> {
  let contentLocation;

  // This allows an implementor to escape this entire process, if they return undefined, we'll use the original and not try and resolve
  // a content location
  if (options.getContentLocation) {
    contentLocation = await options.getContentLocation(request, async (url: string) => getPath(url, options));
  }

  const givenPath = await getPath(contentLocation || request.url, options);

  async function stat(path: string): Promise<fs.Stats> {
    return new Promise(
      resolve => options.fs.stat(
        path,
        (error, stat) => resolve(error ? undefined : stat)
      )
    );
  }

  const givenPathStat = await stat(givenPath);

  if (!options.getPossibleSuffixes || options.getContentLocation) {
    return { stat: givenPathStat, contentLocation }; // Doesn't matter what it is, they aren't trying out extensions
  }

  if (givenPathStat && givenPathStat.isFile()) {
    return { stat: givenPathStat };
  }

  const suffixes = await options.getPossibleSuffixes(request, givenPath);

  if (!suffixes.length) {
    // No contentLocation needed
    return { stat: givenPathStat };
  }

  // Filter through the available
  const { suffix, stat: suffixStat } = await suffixes.reduce(
    async (previous, suffix): Promise<{ suffix: string, stat: fs.Stats }> => {
      const previousSuffixFound = await previous;
      if (previousSuffixFound.stat && previousSuffixFound.stat.isFile()) {
        return previousSuffixFound;
      }
      return {
        stat: await stat(`${givenPath}${suffix}`),
        suffix
      };
    },
    Promise.resolve({ suffix: "", stat: givenPathStat })
  );

  const url = new URL(request.url);
  // Only append to the path, not the query or anything
  url.pathname += suffix;
  return {
    contentLocation: url.toString(),
    stat: suffixStat
  };
}
