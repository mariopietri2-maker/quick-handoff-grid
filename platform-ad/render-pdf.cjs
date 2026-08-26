const { chromium } = require("playwright");
const p = require("path");
const fs = require("fs");

(async () => {
  const deckPath = process.argv[2] || p.join(__dirname, "deck.html");
  const outFile = process.argv[3] || p.join(__dirname, "fresh-delivery-presentation.pdf");

  const context = await chromium.launchPersistentContext(p.join(__dirname, ".pdf-tmp", "profile"), {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = context.pages()[0] || await context.newPage();
  const url = "file:///" + p.resolve(deckPath).replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(800);

  await page.pdf({
    path: outFile,
    width: "297mm",
    height: "210mm",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });

  await context.close();
  fs.rmSync(p.join(__dirname, ".pdf-tmp"), { recursive: true, force: true });
  const stat = fs.statSync(outFile);
  console.log("WROTE", outFile, stat.size + " bytes");
})();
