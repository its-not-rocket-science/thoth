// One-off generator: rasterises public/favicon.svg to the PNG fallbacks
// referenced from index.html, using the already-installed Playwright
// devDependency rather than adding an image-processing package. Re-run this
// (`npm run generate:favicons`) whenever favicon.svg changes.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const svg = readFileSync(`${root}public/favicon.svg`, "utf8");

const targets = [
  { size: 32, file: "public/favicon-32x32.png" },
  { size: 180, file: "public/apple-touch-icon.png" },
];

const browser = await chromium.launch();
try {
  for (const { size, file } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;}svg{display:block;}</style></head><body>${svg}</body></html>`,
    );
    await page.locator("svg").evaluate((el, px) => {
      el.setAttribute("width", String(px));
      el.setAttribute("height", String(px));
    }, size);
    const buffer = await page.locator("svg").screenshot({ omitBackground: false });
    writeFileSync(`${root}${file}`, buffer);
    await page.close();
    console.log(`wrote ${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
