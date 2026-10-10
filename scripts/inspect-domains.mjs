import { readFileSync } from "node:fs";

const auth = JSON.parse(readFileSync(process.env.HOME + "/.local/share/com.vercel.cli/auth.json", "utf8"));
const token = auth.token;
const teamSlug = "adityaagustiawans-projects";
const H = { Authorization: `Bearer ${token}`, "x-vercel-scope": teamSlug };

const dom = await (await fetch(`https://api.vercel.com/v9/projects/nexconsole/domains`, { headers: H })).json();
for (const d of (dom.domains || [])) {
  console.log("=== domain:", d.name);
  console.log(JSON.stringify(d, null, 1));
}
const proj = await (await fetch(`https://api.vercel.com/v9/projects/nexconsole`, { headers: H })).json();
console.log("\nproject productionBranch:", proj.productionBranch);
console.log("project gitRepo:", proj.link?.type, proj.link?.repo);
console.log("ssoProtection:", JSON.stringify(proj.ssoProtection));