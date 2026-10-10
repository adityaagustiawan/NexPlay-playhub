import { readFileSync } from "node:fs";

const auth = JSON.parse(readFileSync(process.env.HOME + "/.local/share/com.vercel.cli/auth.json", "utf8"));
const token = auth.token;
const teamSlug = "adityaagustiawans-projects";

const addDomain = await fetch(
  `https://api.vercel.com/v9/projects/nexconsole/domains`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-vercel-scope": teamSlug,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "nexconsole.vercel.app" }),
  }
);
console.log("POST domains ->", addDomain.status);
console.log(await addDomain.text());

// List project domains to confirm
const list = await fetch(
  `https://api.vercel.com/v9/projects/nexconsole/domains`,
  { headers: { Authorization: `Bearer ${token}`, "x-vercel-scope": teamSlug } }
);
const data = await list.json();
console.log("\nProject domains now:", (data.domains || []).map((d) => d.name));