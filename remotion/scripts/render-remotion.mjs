import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// uso: node scripts/render-remotion.mjs <saida.mp4> [idComposicao]
// ou:  node scripts/render-remotion.mjs --lote id1=saida1.mp4 id2=saida2.mp4 ...
const args = process.argv.slice(2);

const jobs = [];
if (args[0] === "--lote") {
  for (const a of args.slice(1)) {
    const [id, out] = a.split("=");
    jobs.push({ id, out });
  }
} else {
  jobs.push({ out: args[0] ?? "/mnt/documents/amz-teaser-vertical.mp4", id: args[1] ?? "main" });
}

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

for (const job of jobs) {
  const composition = await selectComposition({
    serveUrl: bundled,
    id: job.id,
    puppeteerInstance: browser,
  });

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: job.out,
    puppeteerInstance: browser,
    muted: true,
    concurrency: 1,
  });
  console.log("ok", job.id, "->", job.out);
}

await browser.close({ silent: false });
console.log("done");
