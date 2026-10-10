import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:8080/", { waitUntil: "networkidle" });
const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
console.log("Has NEXCONSOLE:", text.includes("NEXCONSOLE"));
console.log("Leftover NEXPLAY:", /NEXPLAY/.test(text));
console.log("Title:", await p.title());
// sidebar brand lockup: check an svg icon renders inside the brand h1
const brand = p.locator("nav h1").first();
const hasIcon = (await brand.locator("svg").count()) > 0;
console.log("Sidebar logo icon present:", hasIcon);
console.log("Sidebar brand text:", (await brand.innerText()).replace(/\s+/g, " "));
await b.close();
