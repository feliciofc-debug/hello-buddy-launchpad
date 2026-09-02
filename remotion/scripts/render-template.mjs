import { existsSync } from "fs";
// Renderiza uma composição paramétrica a partir de um JSON de props.
// Uso: node scripts/render-template.mjs <composicao> <props.json> <saida.mp4>
// É este script que o worker da VPS chama para cada job da fila.

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [compId = "template-agente", propsPath, outPath = "/mnt/documents/template.mp4"] =
  process.argv.slice(2);

if (!propsPath) {
  console.error("uso: node scripts/render-template.mjs <composicao> <props.json> <saida.mp4>");
  process.exit(1);
}

const inputProps = JSON.parse(fs.readFileSync(propsPath, "utf8"));

const serveUrl = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: acharChromium(),
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl,
  id: compId,
  inputProps,
  puppeteerInstance: browser,
});

await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  inputProps,
  outputLocation: outPath,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
});

await browser.close({ silent: false });
console.log("ok", compId, "->", outPath, `${composition.durationInFrames} frames`);
