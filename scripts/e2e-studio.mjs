// Studio E2E: verifies the Blender-style shell and the Muse AI assistant end to
// end — a single top menu bar, the viewport prompt bar, a build prompt that
// applies a 3D shooter config, the activity overlay, and no console/page errors.
//
// Usage:
//   STUDIO_URL=http://localhost:8080/studio node scripts/e2e-studio.mjs
//   STUDIO_URL=https://getnexstudio.vercel.app/studio node scripts/e2e-studio.mjs
import { chromium } from "playwright";

const URL = process.env.STUDIO_URL || "http://localhost:8080/studio";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const report = { url: URL };

async function run(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  const r = { label, width, errors };

  // Wait until the studio renders (retry while a fresh deploy comes up).
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);
      if (await page.getByText(/Try:/).first().isVisible().catch(() => false)) break;
    } catch {
      /* retry */
    }
    await sleep(4000);
  }
  r.studioReady = await page.getByText(/Try:/).first().isVisible().catch(() => false);

  // Exactly one top menu bar (guards against the duplicate-bar regression).
  r.fileMenuCount = await page.getByRole("button", { name: "File", exact: true }).count();
  r.promptBarVisible = await page.getByText(/Try:/).first().isVisible().catch(() => false);
  r.panelVisible = await page.getByText(/Muse · AI/).first().isVisible().catch(() => false);

  // Drive Muse from the viewport prompt bar.
  const input = page.getByPlaceholder(/Describe a whole game/).first();
  await input.fill("a hard 3D space shooter called Nova");
  await input.press("Enter");

  r.overlaySeen = await page.getByText(/AI working on/i).first().isVisible().catch(() => false);
  await page.getByText(/Muse used \d+ tool/).first().waitFor({ timeout: 20000 });
  r.toolSummary = await page.getByText(/Muse used \d+ tool/).first().innerText();
  await page.waitForTimeout(800);
  r.titleApplied = (await page.getByText(/Nova/).count()) > 0;
  r.statusLooks3DShooter = /3D · shooter/.test(await page.locator("body").innerText());

  r.pass =
    r.studioReady &&
    r.fileMenuCount === 1 &&
    r.promptBarVisible &&
    r.titleApplied &&
    r.statusLooks3DShooter &&
    errors.length === 0;

  await page.close();
  return r;
}

try {
  // Narrow: side panel is hidden (< lg) but the prompt bar must still work.
  report.narrow = await run(820, 800, "narrow-820");
  // Wide: both the prompt bar and the side panel are visible.
  report.wide = await run(1440, 900, "wide-1440");
  report.pass = report.narrow.pass && report.wide.pass;
  report.panelHiddenWhenNarrow = report.narrow.panelVisible === false;
} catch (e) {
  report.error = String(e);
  report.pass = false;
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
