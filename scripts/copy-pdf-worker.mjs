// Copy the pdf.js worker into public/ so it is served as a static asset.
// Webpack cannot bundle the worker (.mjs uses import.meta); serving it from
// public/ side-steps that. Runs on postinstall so the version always matches
// the installed pdfjs-dist.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const src = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
const dest = "public/pdf.worker.min.mjs";

if (!existsSync(src)) {
  console.warn("pdf.js worker not found at " + src + " (skipping copy).");
  process.exit(0);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("Copied pdf.js worker -> " + dest);
