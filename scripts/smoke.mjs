// Quick runtime smoke test: loads every route, captures console errors & page errors.
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE || "http://localhost:8080";
const routes = ["/", "/explore", "/create", "/friends", "/topup", "/login", "/signup", "/profile", "/game/1", "/nope"];

const browser = await chromium.launch();
const page = await browser.newPage();
const issues = [];

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  // NotFound.tsx intentionally logs a 404 for the /nope route check
  if (text.includes("non-existent route")) return;
  issues.push(`[console] ${text}`);
});
page.on("pageerror", (err) => issues.push(`[pageerror] ${err.message}`));

for (const route of routes) {
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  // give client-side routing a beat
  await page.waitForTimeout(500);
  const title = await page.title();
  const bodyText = (await page.locator("body").innerText()).slice(0, 80).replace(/\s+/g, " ");
  console.log(`${res.status()} ${route.padEnd(10)} title="${title}" body="${bodyText}"`);
}

// /topup and /profile should redirect to /login when signed out
await page.goto(`${BASE}/topup`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const redirectedTo = new URL(page.url()).pathname;
console.log("redirect /topup ->", page.url());
if (redirectedTo !== "/login") issues.push(`[redirect] /topup should go to /login, went to ${redirectedTo}`);

await browser.close();

if (issues.length) {
  console.log("\n--- RUNTIME ISSUES ---");
  for (const i of issues) console.log(i);
  process.exit(1);
} else {
  console.log("\nNo console/page errors on any route.");
}