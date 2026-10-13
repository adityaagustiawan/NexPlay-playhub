import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function open3D() {
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
  await page.locator('button:has-text("3D")').last().click();
  await sleep(700);
  return page;
}

// 1) Click the cube in object mode, then Edit Mode + Select All
{
  const page = await open3D();
  const box = await page.locator("canvas[data-edit-mode]").first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 30);
  await sleep(500);
  const before = await page.getByText(/verts$/).first().textContent().catch(() => null);
  await page.locator('button:has-text("Object Mode")').first().click();
  await sleep(250);
  await page.getByText("Edit Mode", { exact: true }).first().click();
  await sleep(500);
  const afterMode = await page.getByText(/verts$/).first().textContent().catch(() => null);
  const selAll = page.getByRole("button", { name: "Select All" });
  console.log("selectAll count:", await selAll.count());
  await selAll.first().click();
  await sleep(500);
  const afterAll = await page.getByText(/verts$/).first().textContent().catch(() => null);
  const selText = await page.getByText(/\d+ selected/).first().textContent().catch(() => null);
  console.log("barBefore:", before, "| afterMode:", afterMode, "| afterAll:", afterAll, "| sel:", selText);
  await page.close();
}

// 2) POV: toggle, drag to aim, check the canvas changes; also try plain "0"
{
  const page = await open3D();
  await page.locator('button[title="Camera POV (0)"]').click();
  await sleep(500);
  const hash = () => page.evaluate(() => {
    const c = document.querySelector('[data-camera-pov]');
    const g = c.getContext("2d");
    const d = g.getImageData(0, 0, 200, 120).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 13) h = (h * 31 + d[i]) | 0;
    return h;
  });
  const h1 = await hash();
  const box = await page.locator("canvas[data-camera-pov]").first().boundingBox();
  console.log("box:", JSON.stringify(box));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 80, { steps: 12 });
  await page.mouse.up();
  await sleep(500);
  const h2 = await hash();
  console.log("pov hash changed by drag:", h1 !== h2, h1, h2);
  await page.keyboard.press("0");
  await sleep(500);
  const off = await page.locator('[data-camera-pov="off"]').count();
  console.log("after plain 0 key, pov=off count:", off);
  await page.close();
}

// 3) Add flyout from the toolbar
{
  const page = await open3D();
  const addBtn = page.locator('button[title="Add"]');
  console.log("add tool buttons:", await addBtn.count());
  await addBtn.first().click();
  await sleep(500);
  const uv = await page.getByText("UV Sphere").count();
  console.log("flyout UV Sphere visible count:", uv);
  if (uv) {
    await page.getByText("UV Sphere").first().click();
    await sleep(600);
    console.log("outliner now has UV Sphere:", await page.getByText("UV Sphere", { exact: true }).count());
  }
  await page.close();
}

await browser.close();
