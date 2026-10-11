import { chromium } from "playwright";

const URL = process.env.STUDIO_URL || "http://localhost:8080/studio";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const out = {};
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);

// 1) Intro appears and AUTO-advances into the tour (no clicks).
out.introShown = await page.locator('[data-testid="studio-intro"]').isVisible().catch(() => false);
await page.locator('[data-testid="studio-tour"]').waitFor({ timeout: 6000 }).catch(() => {});
out.tourAutoOpened = await page.locator('[data-testid="studio-tour"]').isVisible().catch(() => false);

// 2) Auto-advance: the step counter/title should change over time.
const title1 = await page.locator('[data-testid="studio-tour"] h3').first().innerText().catch(() => "");
await page.waitForTimeout(3600);
const title2 = await page.locator('[data-testid="studio-tour"] h3').first().innerText().catch(() => "");
out.tourAutoAdvanced = title1 !== "" && title1 !== title2;
out.tourTitles = [title1, title2];

// 3) Dismiss and confirm it does not come back.
await page.locator('[data-testid="studio-tour-done"]').click();
await page.waitForTimeout(400);
out.tourGoneAfterClose = !(await page.locator('[data-testid="studio-tour"]').isVisible().catch(() => false));

// 4) Tool tips: hover a toolbar tool and read the tooltip.
const tool = page.locator('button[title="Move"]').first();
await tool.hover();
await page.waitForTimeout(900);
out.toolTipText = await page.locator('[role="tooltip"]').first().innerText().catch(() => "");

// 5) Help menu contains the tour + tips entries.
await page.getByRole("button", { name: "Help", exact: true }).click();
await page.waitForTimeout(300);
const menuText = await page.locator('[role="menu"]').first().innerText().catch(() => "");
out.helpHasTutorial = /How to use \(tutorial\)/.test(menuText);
out.helpHasTips = /Show tool tips/.test(menuText);
out.helpHasReplayIntro = /Replay opening animation/.test(menuText);
await page.keyboard.press("Escape");

out.errors = errors;
out.pass =
  out.introShown && out.tourAutoOpened && out.tourAutoAdvanced && out.tourGoneAfterClose &&
  /Move/.test(out.toolTipText) && out.helpHasTutorial && out.helpHasTips && out.helpHasReplayIntro &&
  errors.length === 0;

console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(out.pass ? 0 : 1);
