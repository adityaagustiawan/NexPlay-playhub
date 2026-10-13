import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
await page.goto("http://localhost:5199/studio", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 8; i++) {
  await sleep(1000);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 150).replace(/\n/g, " "));
  console.log(i + "s:", body);
}
await browser.close();
