import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
const r = await p.goto("https://getnexstudio.vercel.app/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
console.log("status", r.status());
console.log("url", p.url());
const info = await p.evaluate(() => ({
  host: window.location.hostname,
  path: window.location.pathname,
  includes: window.location.hostname.includes("nexstudio"),
  startsWith: window.location.hostname.startsWith("nexstudio."),
  text: document.body.innerText.slice(0, 120).replace(/\s+/g, " "),
}));
console.log(JSON.stringify(info, null, 2));
await b.close();
