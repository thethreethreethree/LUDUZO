// Registers the "@/…" alias resolve hook on the main thread before any test module
// loads. Use via:  node --experimental-strip-types --import ./scripts/register-tsalias.mjs <test>
import { register } from "node:module";

register("./tsalias-loader.mjs", import.meta.url);
