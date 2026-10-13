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

const outlinerText = () =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll("div")].filter((n) => n.textContent?.trim() === "SCENE COLLECTION");
    for (const n of nodes) {
      const box = n.closest("div[style]") ?? n.parentElement;
      if (box) return box.innerText.replace(/\n/g, " | ");
    }
    return null;
  });

console.log("before add:", await outlinerText());

const addTool = page.locator('button[title="Add"]').first();
for (const label of ["Spot", "Camera", "UV Sphere", "Torus"]) {
  await addTool.click();
  await sleep(350);
  await page.locator("[data-add-flyout] button", { hasText: label }).first().click();
  await sleep(500);
}
console.log("after adds:", await outlinerText());
await browser.close();
