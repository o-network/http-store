// These won't result in a value that is "below" the root directory of from

function returnIfSafe(value: string): string {

  if (/[\\/]\.\.[\\/]/.test(value)) {
    throw new Error("Cannot have /../ segment in path");
  }

  return value;
}

export function joinWithRoot(fromRoot: string, to: string): string {
  // Don't let anyone go before the root
  const toWithoutFluff = to.replace(/^\.*\//g, "");
  return fromRoot.replace(/\/+$/, "") + "/" + returnIfSafe(toWithoutFluff);
}

export function resolve(from: string, to: string): string {
  const fromAsDirectory = from.substr(0, from.lastIndexOf("/")) + "/";
  if (to.indexOf("/") === 0) {
    return returnIfSafe(to);
  }
  if (to.indexOf("../") === 0) {
    return resolve(
      fromAsDirectory.replace(/[^\/]+\/$/, ""),
      to.replace(/^\.\.\//, "")
    );
  }
  let rest = to;
  if (rest.indexOf("./") === 0) {
    rest = rest.replace(/^\.\//, "");
  }
  // rest shouldn't be relative by this point, so we can just add
  return `${fromAsDirectory}${returnIfSafe(rest)}`;
}
