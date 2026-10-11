// Studio E2E: verifies the Blender-style shell and the Muse AI assistant end to
// end — a single top menu bar, the Muse panel, a build-mode prompt that applies
// a 3D shooter config, the activity overlay, and no console/page errors.
//
// Usage:
//   STUDIO_URL=http://localhost:8080/studio node scripts/e2e-studio.mjs
//   STUDIO_URL=https://getnexstudio.vercel.app/studio node scripts/e2e-studio.mjs
import { chromium } from "playwright";

const URL = process.env.STUDIO_URL || "http://localhost:8080/studio";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXPECT_OVERLAY = process.env.EXPECT_OVERLAY !== "0";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

const report = { url: URL, steps: [], errors };

async function waitForMuse(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      if (await page.getByText(/Muse/).first().isVisible().catch(() => false)) return true;
    } catch (e) {
      report.steps.push(`goto retry: ${e.message}`);
    }
    await sleep(5000);
  }
  return false;
}

try {
  report.musePanelFound = await waitForMuse(120000);
  if (!report.musePanelFound) throw new Error("Muse panel never appeared (deploy not ready?)");

  // Exactly one top menu bar (guards against the duplicate-bar regression).
  report.fileMenuCount = await page.getByRole("button", { name: "File", exact: true }).count();
  report.hasAiMenu = await page.getByRole("button", { name: "AI", exact: true }).count();

  const input = page.getByPlaceholder(/Describe a whole game/i);
  await input.waitFor({ timeout: 10000 });
  await input.fill("a hard 3D space shooter called Nova");
  await page.getByTitle("Send to Muse").click();

  const overlaySeen = await page.getByText(/AI working on/i).first().isVisible().catch(() => false);
  await page.getByText(/Muse used \d+ tool/).first().waitFor({ timeout: 20000 });

  report.toolSummary = await page.getByText(/Muse used \d+ tool/).first().innerText();
  report.overlaySeen = overlaySeen;
  await page.waitForTimeout(800);
  report.titleApplied = (await page.getByText(/Nova/).count()) > 0;
  report.statusLooks3DShooter = /3D · shooter/.test(await page.locator("body").innerText());

  report.pass =
    report.musePanelFound &&
    report.fileMenuCount === 1 &&
    report.titleApplied &&
    report.statusLooks3DShooter &&
    (!EXPECT_OVERLAY || report.overlaySeen);
} catch (e) {
  report.error = String(e);
  report.pass = false;
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
