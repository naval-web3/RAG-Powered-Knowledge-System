// Render every diagram in assets/diagrams-src/*.html to a PNG in
// assets/diagrams/, at twice the CSS resolution so the lines stay crisp when
// the report is printed.
//
//   cd report/assets && node ..\..\.tools\shots\node_modules\playwright ... (no)
//   node render-diagrams.mjs            # render all
//   node render-diagrams.mjs er dfd1    # render only the named ones
//
// Playwright comes from .tools/shots, which already has it installed for the
// screen captures, so nothing new needs downloading.

import { chromium } from "../../.tools/shots/node_modules/playwright/index.mjs";
import { readdirSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "diagrams-src");
const OUT = join(HERE, "diagrams");
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const pages = readdirSync(SRC)
  .filter((f) => f.endsWith(".html"))
  .filter((f) => only.length === 0 || only.some((name) => f.includes(name)));

if (pages.length === 0) {
  console.error("nothing to render");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

for (const file of pages) {
  const url = pathToFileURL(join(SRC, file)).href;
  await page.goto(url, { waitUntil: "networkidle" });
  // Every diagram page wraps its drawing in #sheet; shooting that element
  // rather than the viewport means the PNG has no margin to trim and the
  // figure sits at its natural aspect ratio in the report.
  const sheet = await page.$("#sheet");
  const target = sheet || page;
  const out = join(OUT, file.replace(/\.html$/, ".png"));
  await target.screenshot({ path: out });
  const box = sheet ? await sheet.boundingBox() : null;
  console.log(
    "  %s  %s",
    file.replace(/\.html$/, ".png").padEnd(34),
    box ? `${Math.round(box.width)}x${Math.round(box.height)} css` : ""
  );
}

await browser.close();
