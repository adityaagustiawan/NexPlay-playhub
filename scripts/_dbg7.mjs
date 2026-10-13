import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
await page.goto("http://localhost:5199/studio", { waitUntil: "domcontentloaded" });
await sleep(1800);
const skip = page.locator('[data-testid="studio-intro-skip"]');
if (await skip.isVisible().catch(() => false)) await skip.click();
await sleep(400);
const tour = page.locator('[data-testid="studio-tour"]');
if (await tour.isVisible().catch(() => false)) await tour.locator('[data-testid="studio-tour-done"]').click();
await sleep(400);
await page.locator('button:has-text("3D")').last().click({ timeout: 5000 }).catch(() => {});
await sleep(800);

const add = page.locator('button[title="Add"]');
console.log("add buttons:", await add.count());
for (let i = 0; i < (await add.count()); i++) {
  console.log("  " + i, await add.nth(i).getAttribute("title"), "visible:", await add.nth(i).isVisible());
}

const open = async (n) => {
  await add.nth(n).click();
  await sleep(400);
  return page.locator("[data-add-flyout]").count();
};

console.log("open #1:", await open(0));
await page.locator("[data-add-flyout] button", { hasText: "Spot" }).first().click();
await sleep(500);
console.log("after Spot, flyout count:", await page.locator("[data-add-flyout]").count());
console.log("open #2:", await open(0));
console.log("flyout buttons:", await page.locator("[data-add-flyout] button").allTextContents());
await browser.close();
