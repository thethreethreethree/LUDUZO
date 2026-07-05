// ESM resolve hook: map the project's "@/…" path alias (tsconfig `paths`) to files
// under ./src so unit tests can import alias-using modules while running under Node's
// --experimental-strip-types, which has no tsconfig awareness. Test tooling only —
// never loaded by the app (Next's bundler resolves the alias in prod).
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = pathResolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

// The app writes extensionless alias imports (e.g. "@/lib/pg-errors"); the bundler
// fills in the extension. Replicate that here: try the bare path, common extensions,
// then an index file.
function resolveToFile(base) {
  for (const ext of ["", ".ts", ".tsx", ".mjs", ".js"]) {
    const p = base + ext;
    if (existsSync(p)) return p;
  }
  for (const ext of [".ts", ".tsx"]) {
    const p = pathResolve(base, "index" + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = resolveToFile(pathResolve(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
