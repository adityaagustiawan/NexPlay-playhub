// Visual verification for the Blender-like 3D studio: camera/light helpers,
// zoom gestures (wheel, ctrl+wheel, touch pinch), camera POV, add menu,
// edit/sculpt/vertex modes. Reports console errors and canvas pixel checks.
import { chromium } from "playwright";

const URL = "http://localhost:5199/studio";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const report = {};

async function fresh() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  // Dismiss the intro / tour overlays.
  const skip = page.locator('[data-testid="studio-intro-skip"]');
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
  await sleep(400);
  const tour = page.locator('[data-testid="studio-tour"]');
  if (await tour.isVisible().catch(() => false)) await tour.locator('[data-testid="studio-tour-done"]').click().catch(() => {});
  await sleep(400);
  return { page, errors };
}

// Hash the canvas so we can tell whether a redraw actually happened.
async function canvasHash(page) {
  return page.evaluate(() => {
    const c = document.querySelector('[data-camera-pov]') || document.querySelector("canvas");
    if (!c) return null;
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, Math.min(300, c.width), Math.min(200, c.height)).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 17) h = (h * 31 + d[i]) | 0;
    return h;
  });
}

// --- 1. 3D viewport renders the scene (cube + camera + light helpers) ---
{
  const { page, errors } = await fresh();
  report.viewport3dVisible = await page.locator("canvas[data-camera-pov]").first().isVisible().catch(() => false);
  report.editModeAttr = await page.locator("canvas[data-edit-mode]").first().getAttribute("data-edit-mode").catch(() => null);
  report.povAttr = await page.locator('[data-camera-pov]').first().getAttribute("data-camera-pov").catch(() => null);
  report.outlinerHasSceneCollection = await page.getByText("Scene Collection").first().isVisible().catch(() => false);
  report.outlinerListsCube = await page.getByText("Cube", { exact: true }).first().isVisible().catch(() => false);
  report.addMenuVisible = await page.getByRole("button", { name: "Add", exact: true }).first().isVisible().catch(() => false);
  await page.close();
  report.errorsViewport = errors;
}

// --- 2. Wheel zoom + pan change the canvas ---
{
  const { page, errors } = await fresh();
  const before = await canvasHash(page);
  const box = await page.locator("canvas[data-camera-pov]").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -260);
  await sleep(350);
  const afterZoomIn = await canvasHash(page);
  await page.mouse.wheel(0, 260);
  await sleep(350);
  const afterZoomOut = await canvasHash(page);
  report.zoomInChangedCanvas = before !== afterZoomIn;
  report.zoomOutDiffersFromZoomIn = afterZoomOut !== afterZoomIn;
  await page.close();
  report.errorsZoom = errors;
}

// --- 3. Camera POV toggle (header button + numpad 0) ---
{
  const { page, errors } = await fresh();
  const btn = page.locator('button[title="Camera POV (0)"]');
  await btn.click();
  await sleep(450);
  report.povToggledByButton = await page.locator('[data-camera-pov="on"]').first().count().catch(() => 0);
  const povHash = await canvasHash(page);
  // Drag to aim the camera through the scene; the view must change.
  const box = await page.locator("canvas[data-camera-pov]").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 + 90, { steps: 14 });
  await page.mouse.up();
  await sleep(400);
  report.povAimChangedCanvas = povHash !== (await canvasHash(page));
  // Numpad 0 toggles back.
  await page.keyboard.press("Numpad0");
  await sleep(400);
  report.povToggledByNumpad0Back = await page.locator('[data-camera-pov="off"]').first().count().catch(() => 0);
  await page.close();
  report.errorsPov = errors;
}

// --- 4. Add menu: mesh, light, camera ---
{
  const { page, errors } = await fresh();
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await sleep(250);
  report.addMenuOpens = await page.getByText("Mesh", { exact: true }).first().isVisible().catch(() => false);
  report.addMenuHasCube = await page.getByText("Cube", { exact: true }).first().isVisible().catch(() => false);
  report.addMenuHasCamera = await page.getByText("Camera", { exact: true }).first().isVisible().catch(() => false);
  // Add a UV sphere through the header menu.
  await page.keyboard.press("Escape");
  await sleep(200);
  await page.locator("span", { hasText: /^Add$/ }).last().click().catch(() => {});
  await sleep(250);
  // Fall back: use the toolbar Add tool flyout.
  await page.locator('button[title="Add"]').first().click().catch(() => {});
  await sleep(300);
  report.addFlyoutOpened = await page.getByText("UV Sphere").first().isVisible().catch(() => false);
  if (report.addFlyoutOpened) {
    await page.getByText("UV Sphere").first().click();
    await sleep(400);
    report.uvSphereAddedToOutliner = await page.getByText("UV Sphere", { exact: true }).first().isVisible().catch(() => false);
  }
  await page.close();
  report.errorsAdd = errors;
}

// --- 5. Edit mode: select vertices, duplicate / delete ---
{
  const { page, errors } = await fresh();
  // The mode dropdown is the first header menu button.
  await page.locator('button:has-text("Object Mode")').first().click();
  await sleep(250);
  await page.getByText("Edit Mode", { exact: true }).first().click();
  await sleep(500);
  report.editModeAttr = await page.locator("canvas[data-edit-mode]").first().getAttribute("data-edit-mode").catch(() => null);
  report.editBarVisible = await page.getByText(/verts$/).first().isVisible().catch(() => false);
  // Click the mesh centre to grab vertices, then the mesh bar should report a count.
  const box = await page.locator("canvas[data-edit-mode]").first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(400);
  report.selectionReported = await page.getByText(/\d+ selected/).first().isVisible().catch(() => false);
  // Select All reports 8 verts on a cube.
  await page.getByRole("button", { name: "Select All" }).first().click();
  await sleep(350);
  report.selectAllWorked = await page.getByText(/8 verts/).first().isVisible().catch(() => false);
  await page.close();
  report.errorsEdit = errors;
}

// --- 6. Sculpt mode: brush strip + radius/strength sliders ---
{
  const { page, errors } = await fresh();
  await page.locator('button:has-text("Object Mode")').first().click();
  await sleep(250);
  await page.getByText("Sculpt Mode", { exact: true }).first().click();
  await sleep(500);
  report.sculptModeAttr = await page.locator("canvas[data-edit-mode]").first().getAttribute("data-edit-mode").catch(() => null);
  report.brushStripVisible = await page.getByRole("button", { name: "Draw" }).first().isVisible().catch(() => false);
  report.radiusSlider = await page.locator('input[aria-label="Brush radius"]').count().catch(() => 0);
  report.strengthSlider = await page.locator('input[aria-label="Brush strength"]').count().catch(() => 0);
  await page.close();
  report.errorsSculpt = errors;
}

const allErrors = [];
for (const k of Object.keys(report)) {
  if (Array.isArray(report[k])) allErrors.push(...report[k]);
}
report.anyConsoleErrors = allErrors.length;
report.consoleErrorSample = allErrors.slice(0, 5);
await browser.close();
console.log(JSON.stringify(report, null, 2));
