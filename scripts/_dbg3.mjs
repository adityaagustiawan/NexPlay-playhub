import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 300)));
await page.goto("http://localhost:5199/studio", { waitUntil: "domcontentloaded" });
await sleep(1800);
const skip = page.locator('[data-testid="studio-intro-skip"]');
if (await skip.isVisible().catch(() => false)) await skip.click();
await sleep(400);
const tour = page.locator('[data-testid="studio-tour"]');
if (await tour.isVisible().catch(() => false)) await tour.locator('[data-testid="studio-tour-done"]').click();
await sleep(400);
await page.locator('button:has-text("3D")').last().click();
await sleep(800);

await page.evaluate(() => {
  const c = document.querySelector("canvas[data-edit-mode]");
  window.__ev = [];
  c.addEventListener("pointerdown", (e) => window.__ev.push("down " + e.button), true);
  c.addEventListener("pointermove", (e) => window.__ev.push("move"), true);
  c.addEventListener("pointerup", (e) => window.__ev.push("up"), true);
});

const box = await page.locator("canvas[data-edit-mode]").first().boundingBox();
console.log("canvas box:", JSON.stringify(box));
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2 + 30;
await page.mouse.click(cx, cy);
await sleep(600);
console.log("events:", (await page.evaluate(() => window.__ev)).slice(0, 5));
await page.screenshot({ path: "/tmp/opencode/studio-3d.png" });
console.log("screenshot saved");

// Now POV + drag
await page.locator('button[title="Camera POV (0)"]').click();
await sleep(500);
await page.evaluate(() => { window.__ev.length = 0; });
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 80, { steps: 12 });
await page.mouse.up();
await sleep(500);
console.log("pov drag events:", (await page.evaluate(() => window.__ev)).slice(0, 8));
await page.screenshot({ path: "/tmp/opencode/studio-pov.png" });

// Add flyout
await page.locator('button[title="Add"]').first().click();
await sleep(500);
console.log("flyout present:", await page.locator("[data-add-flyout]").count());
await page.screenshot({ path: "/tmp/opencode/studio-add.png" });
await browser.close();
