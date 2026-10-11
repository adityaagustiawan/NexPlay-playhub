import { chromium } from "playwright";

const URL = process.env.STUDIO_URL || "https://getnexstudio.vercel.app/studio";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const ready = await waitForMuse(120000);
  report.musePanelFound = ready;
  if (!ready) throw new Error("Muse panel never appeared (deploy not ready?)");

  // Duplicate top-bar check: how many NexPlay logos render?
  report.nexplayLogoCount = await page.getByText("NexPlay", { exact: true }).count();

  // AI top menu present?
  report.hasAiMenu = await page.getByRole("button", { name: "AI", exact: true }).count();

  // Build mode is the default; send a prompt.
  const input = page.getByPlaceholder(/Describe a whole game/i);
  await input.waitFor({ timeout: 10000 });
  await input.fill("a hard 3D space shooter called Nova");
  await page.getByTitle("Send to Muse").click();

  // The activity overlay should flash while Muse works.
  const overlaySeen = await page
    .getByText(/AI working on/i)
    .first()
    .isVisible()
    .catch(() => false);

  // Wait for the tools box.
  await page.getByText(/Muse used \d+ tool/).first().waitFor({ timeout: 20000 });
  report.toolSummary = await page.getByText(/Muse used \d+ tool/).first().innerText();
  report.overlaySeen = overlaySeen;

  // Config applied: title + 3D mode should show up in the chrome/status bar.
  await page.waitForTimeout(800);
  report.titleApplied = (await page.getByText(/Nova/).count()) > 0;

  const statusText = await page
    .locator("div")
    .filter({ hasText: /unsaved · 3D · shooter/ })
    .first()
    .innerText()
    .catch(() => "");
  report.statusLooks3DShooter = /3D · shooter/.test(await page.locator("body").innerText());

  report.pass =
    report.musePanelFound &&
    report.nexplayLogoCount <= 1 &&
    report.titleApplied &&
    report.statusLooks3DShooter;
} catch (e) {
  report.error = String(e);
  report.pass = false;
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
