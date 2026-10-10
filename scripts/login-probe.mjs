import { chromium } from "playwright";

const BASE = process.env.BASE || "https://nexconsole.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "probe@example.com");
await page.fill('input[type="password"]', "password123");
await page.click('button[type="submit"]');
await page.waitForTimeout(6000);

const body = (await page.locator("form").innerText()).replace(/\s+/g, " ").slice(0, 300);
console.log("form text:", body);
console.log("\n--- console/network ---");
console.log(logs.join("\n"));
await browser.close();
