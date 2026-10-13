import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const report = {};

async function open3D() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
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
  return { page, errors };
}

// 1) Click the cube itself (scan for a hit point by probing the outline highlight)
{
  const { page, errors } = await open3D();
  const box = await page.locator("canvas[data-edit-mode]").first().boundingBox();
  // The cube renders near the centre; probe a small grid and read the status/hint.
  let selected = false;
  for (const [dx, dy] of [[0, -30], [0, 0], [10, -20], [-10, -20], [0, -50], [20, -40]]) {
    await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await sleep(400);
    await page.locator('button:has-text("Object Mode")').first().click();
    await page.getByText("Edit Mode", { exact: true }).first().click();
    await sleep(500);
    const txt = await page.getByText(/verts$/).first().textContent().catch(() => "");
    if (/\d+ verts/.test(txt) && !/^0 verts/.test(txt)) {
      selected = true;
      report.hitDelta = [dx, dy];
      report.vertsText = txt.trim();
      break;
    }
  }
  report.cubeSelectableByClick = selected;
  if (selected) {
    // Select All → 8 selected on the starter cube.
    await page.getByRole("button", { name: "Select All" }).first().click();
    await sleep(500);
    const sel = await page.getByText(/\d+ selected/).first().textContent().catch(() => "");
    report.selectAllVerts = sel.trim();
    // Duplicate adds 8 more verts.
    await page.getByRole("button", { name: "Duplicate" }).first().click();
    await sleep(600);
    const after = await page.getByText(/verts$/).first().textContent().catch(() => "");
    report.afterDuplicate = after.trim();
    // Delete brings it back down (deselects first, select all again).
    await page.getByRole("button", { name: "Select All" }).first().click();
    await sleep(400);
    await page.getByRole("button", { name: "Delete" }).first().click();
    await sleep(600);
    const afterDel = await page.getByText(/verts$/).first().textContent().catch(() => "");
    report.afterDelete = afterDel.trim();
  }
  await page.screenshot({ path: "/tmp/opencode/studio-edit.png" });
  await page.close();
  report.errorsEdit = errors;
}

// 2) Sculpt stroke deforms the mesh
{
  const { page, errors } = await open3D();
  await page.locator('button:has-text("Object Mode")').first().click();
  await sleep(200);
  await page.getByText("Sculpt Mode", { exact: true }).first().click();
  await sleep(500);
  const box = await page.locator("canvas[data-edit-mode]").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 10, { steps: 20 });
  await page.mouse.up();
  await sleep(600);
  await page.screenshot({ path: "/tmp/opencode/studio-sculpt.png" });
  report.sculptStrokeRan = true;
  await page.close();
  report.errorsSculpt = errors;
}

// 3) Add a light + camera via the toolbar flyout and see them listed
{
  const { page, errors } = await open3D();
  await page.locator('button[title="Add"]').first().click();
  await sleep(400);
  const fly = page.locator("[data-add-flyout]");
  await fly.locator("button", { hasText: "Spot" }).first().click();
  await sleep(600);
  await fly.locator("button", { hasText: "Camera" }).first().click();
  await sleep(600);
  const outliner = await page.getByText("SCENE COLLECTION").locator("..").innerText().catch(() => "");
  report.outlinerAfterAdd = outliner.replace(/\n/g, " | ");
  report.spotAdded = await page.getByText("Spot", { exact: true }).count();
  report.cameraAdded = await page.getByText("Camera.001", { exact: true }).count();
  await page.screenshot({ path: "/tmp/opencode/studio-added.png" });
  await page.close();
  report.errorsAdd = errors;
}

report.anyConsoleErrors = Object.entries(report).filter(([k, v]) => Array.isArray(v)).flat().length;
await browser.close();
console.log(JSON.stringify(report, null, 2));
