import { generateLocal } from "./lib/server/generator";
import { verifyGame } from "./lib/server/verify";

const cases = [
  "a neon space catcher where you grab energy cores and dodge meteors",
  "an endless runner in the jungle with obstacles and coins",
  "a shooter blasting aliens in space",
  "a relaxing fishing game in the deep sea",
];

let fail = 0;
for (const p of cases) {
  const g = generateLocal(p);
  const v = verifyGame(g);
  if (!v.ok) fail++;
  console.log(`${v.ok ? "PASS" : "FAIL"} mode=${g.gameplay.mode} | ${g.title}`);
  for (const c of v.checks) console.log(`      ${c.ok ? "ok " : "BAD"} ${c.name}: ${c.detail}`);
}

// A deliberately broken config must be rejected.
const broken = generateLocal(cases[0]);
(broken.gameplay as any).theme.player = "not-a-color";
(broken.gameplay as any).speed = -1;
const bv = verifyGame(broken);
console.log(`${!bv.ok ? "PASS" : "FAIL"} broken config rejected: ${bv.ok}`);
if (bv.ok) fail++;

console.log(fail === 0 ? "ALL PASS" : `${fail} FAIL`);
process.exit(fail ? 1 : 0);
