const { chromium } = require("playwright");
const p = require("path");
const fs = require("fs");

(async () => {
  const [pagePath, outDir] = process.argv.slice(2);
  const seconds = Number(process.argv[4] || 22);
  const W = 1280, H = 720;
  const recDir = p.join(outDir, ".rec-tmp");
  fs.rmSync(recDir, { recursive: true, force: true });
  fs.mkdirSync(recDir, { recursive: true });

  const context = await chromium.launchPersistentContext(p.join(recDir, "profile"), {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    viewport: { width: W, height: H },
    recordVideo: { dir: recDir, size: { width: W, height: H } },
  });
  const page = context.pages()[0] || await context.newPage();
  const url = "file:///" + p.resolve(pagePath).replace(/\\/g, "/") + "?adonly";
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(1500);

  const file = await page.video().path();
  await page.waitForTimeout((seconds - 1.5) * 1000);

  await context.close();
  const final = p.join(outDir, "promo-ad.webm");
  fs.copyFileSync(file, final);
  fs.rmSync(recDir, { recursive: true, force: true });
  const stat = fs.statSync(final);
  console.log("WROTE", final, stat.size + " bytes");
})();