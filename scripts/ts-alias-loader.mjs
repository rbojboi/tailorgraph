import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", ".js", ".mjs", ".json"];

function resolveExistingFile(candidate) {
  if (existsSync(candidate)) {
    return candidate;
  }

  if (!path.extname(candidate)) {
    for (const extension of extensions) {
      const withExtension = `${candidate}${extension}`;
      if (existsSync(withExtension)) {
        return withExtension;
      }
    }
  }

  for (const extension of extensions) {
    const indexFile = path.join(candidate, `index${extension}`);
    if (existsSync(indexFile)) {
      return indexFile;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = resolveExistingFile(path.join(projectRoot, specifier.slice(2)));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const resolved = resolveExistingFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
