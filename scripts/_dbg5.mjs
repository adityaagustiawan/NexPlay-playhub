import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5199/studio", { waitUntil: "domcontentloaded" });
await sleep(1800);
const skip = page.locator('[data-testid="studio-intro-skip"]');
console.log("intro visible:", await skip.isVisible().catch(() => "err"));
if (await skip.isVisible().catch(() => false)) { await skip.click(); await sleep(500); }
const tour = page.locator('[data-testid="studio-tour"]');
console.log("tour visible:", await tour.isVisible().catch(() => "err"));
if (await tour.isVisible().catch(() => false)) { await tour.locator('[data-testid="studio-tour-done"]').click(); await sleep(500); }
await sleep(500);
console.log("buttons with 3D:", await page.locator('button:has-text("3D")').count());
const all = await page.locator('button:has-text("3D")').allTextContents();
console.log("texts:", JSON.stringify(all));
for (let i = 0; i < all.length; i++) {
  const el = page.locator('button:has-text("3D")').nth(i);
  const vis = await el.isVisible();
  const en = await el.isEnabled();
  console.log(i, "visible:", vis, "enabled:", en, "text:", JSON.stringify(await el.textContent()));
}
await browser.close();
