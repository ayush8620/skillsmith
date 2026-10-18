#!/usr/bin/env node
// SkillSmith CLI
//   node cli.js validate <skill-dir | SKILL.md> [more…]   check against the Agent Skills spec (no AI, no key needed)
//   node cli.js new "what the skill does and when to use it" [--out ./skills] [--author "Name"] [--tools "git jq"]
const fs = require("fs"), path = require("path");
const { validate } = require("./lib/validate");
const [cmd, ...rest] = process.argv.slice(2);
const opt = (n, d = "") => { const i = rest.indexOf(`--${n}`); return i !== -1 && rest[i + 1] ? rest[i + 1] : d; };
const c = (n, s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);

function printReport(label, r) {
  console.log(`${r.valid ? c("32", "✔ valid") : c("31", "✖ invalid")}  ${label}`);
  r.errors.forEach((e) => console.log(c("31", `  error   ${e}`)));
  r.warnings.forEach((w) => console.log(c("33", `  warning ${w}`)));
  r.tips.forEach((t) => console.log(c("2", `  tip     ${t}`)));
}

if (cmd === "validate") {
  if (!rest.length) { console.error("Usage: skillsmith validate <skill-dir|SKILL.md> [...]"); process.exit(2); }
  let bad = 0;
  for (const p of rest) {
    const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, "SKILL.md") : p;
    if (!fs.existsSync(file)) { console.log(c("31", `✖ not found  ${file}`)); bad++; continue; }
    const r = validate(fs.readFileSync(file, "utf8"), path.basename(path.dirname(path.resolve(file))));
    printReport(file, r); if (!r.valid) bad++;
  }
  process.exit(bad ? 1 : 0);
} else if (cmd === "new") {
  const idea = rest.filter((x, i) => !x.startsWith("--") && !(rest[i - 1] || "").startsWith("--")).join(" ");
  require("./lib/forge").forge({ idea, author: opt("author"), tools: opt("tools") }).then((r) => {
    const dir = path.join(opt("out", "."), r.name);
    if (fs.existsSync(path.join(dir, "SKILL.md"))) { console.error(`${dir}/SKILL.md already exists; not overwriting.`); process.exit(1); }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), r.skillMd.endsWith("\n") ? r.skillMd : r.skillMd + "\n");
    for (const s of r.scripts) {
      const target = path.resolve(dir, s.path);
      if (!target.startsWith(path.resolve(dir) + path.sep)) continue; // never write outside the skill folder
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, s.content);
    }
    console.log(c("1;35", `Created ${dir}/`) + `  (${r.model}${r.repaired ? ", auto-repaired" : ""})`);
    printReport(path.join(dir, "SKILL.md"), r.report);
  }).catch((e) => { console.error("skillsmith:", e.message); process.exit(1); });
} else {
  console.log('SkillSmith: create and validate Agent Skills (agentskills.io)\n  skillsmith validate <skill-dir|SKILL.md> [...]\n  skillsmith new "description" [--out dir] [--author name] [--tools "git jq"]   (needs GEMINI_API_KEY)');
}
