#!/usr/bin/env node
/* Verifică regulile din CLAUDE.md. Cade cu cod 1 dacă vreuna e încălcată. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX = 300;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".js") || name.endsWith(".css")) {
      const n = readFileSync(p, "utf8").split("\n").length;
      if (n > MAX) problems.push(`${p}: ${n} linii, peste limita de ${MAX}`);
    }
  }
}
walk("app");   /* .js si .css, la fel */

const html = readFileSync("index.html", "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html))
  problems.push("index.html: conține cod JavaScript inline");
if (/<style[^>]*>[\s\S]*?\S[\s\S]*?<\/style>/.test(html))
  problems.push("index.html: conține CSS inline");

const state = readFileSync("app/state.js", "utf8");
if (/^\s*import\s/m.test(state))
  problems.push("app/state.js: are importuri — creează dependențe circulare");

if (problems.length) {
  console.error("Reguli încălcate:\n" + problems.map(p => "  - " + p).join("\n"));
  console.error("\nVezi CLAUDE.md.");
  process.exit(1);
}
console.log("Toate regulile respectate.");
