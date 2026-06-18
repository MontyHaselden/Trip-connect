import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

let configured = false;

function resolvePdfJsWorkerPath(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ];

  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("pdfjs-dist/package.json");
    if (!pkgPath.includes("[externals]")) {
      candidates.unshift(path.join(path.dirname(pkgPath), "legacy/build/pdf.worker.mjs"));
    }
  } catch {
    // Next.js may externalize pdfjs-dist — fall back to cwd/node_modules.
  }

  for (const workerPath of candidates) {
    if (existsSync(workerPath)) return workerPath;
  }

  throw new Error(
    "pdfjs-dist worker file not found. Run npm install and ensure pdfjs-dist is available on the server.",
  );
}

/** Preload pdf.js worker for Node — Next.js breaks default worker imports. */
export async function configurePdfJsForServer(): Promise<void> {
  if (configured) return;

  const workerPath = resolvePdfJsWorkerPath();
  const workerUrl = pathToFileURL(workerPath).href;
  const worker = await import(/* webpackIgnore: true */ workerUrl);

  globalThis.pdfjsWorker = {
    WorkerMessageHandler: worker.WorkerMessageHandler,
  };

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  configured = true;
}

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}
