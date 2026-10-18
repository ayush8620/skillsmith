// Generates a spec-compliant SKILL.md with Google Gemma 4, validates it, and asks Gemma to repair it once if needed.
const { gemmaJSON } = require("../api/_gemma");
const { validate } = require("./validate");

async function forge({ idea, tools = "", author = "" }) {
  idea = String(idea || "").slice(0, 2000).trim();
  if (!idea) throw Object.assign(new Error("Describe the skill you want (what it does and when to use it)"), { status: 400 });
  const base = `You write Agent Skills that follow the open standard at agentskills.io.
Rules for SKILL.md frontmatter: name = 1-64 chars, only lowercase a-z, 0-9 and single hyphens, no leading/trailing hyphen;
description = max 1024 chars, says WHAT the skill does and WHEN to use it ("Use when ..."), with task keywords;
optional: license (short, e.g. MIT), compatibility (max 500 chars, only if there are real requirements), metadata (string map, e.g. author, version as quoted string).
Body: Markdown instructions for an AI agent: # Title, ## When to use, ## Prerequisites (if any), ## Steps (numbered, concrete commands), ## Examples, ## Notes / edge cases. Under 150 lines. Never include secrets; use environment variables.
Skill idea: ${idea}
${tools ? `Tools/commands the skill can use: ${String(tools).slice(0, 300)}` : ""}
${author ? `metadata.author: ${String(author).slice(0, 60)}` : ""}`;
  const ask = (extra) => gemmaJSON(`${base}${extra}
Return ONLY JSON: {"name":"skill-name","skillMd":"the complete SKILL.md file content starting with ---","scripts":[{"path":"scripts/example.sh","content":"optional helper script, or omit array items"}],"summary":"one sentence"}`, { maxOutputTokens: 3000 });

  const t0 = Date.now();
  let { data, model } = await ask("");
  let report = validate(data.skillMd, data.name);
  let repaired = false;
  // Repair once, but only if there is time left inside a 60 s serverless limit.
  if (!report.valid && Date.now() - t0 < 25000) {
    const fix = await ask(`\nYour previous SKILL.md failed validation with: ${report.errors.join("; ")}. Fix every error.\nPrevious file:\n${String(data.skillMd).slice(0, 6000)}`);
    const r2 = validate(fix.data.skillMd, fix.data.name);
    if (r2.valid || r2.errors.length < report.errors.length) { data = fix.data; model = fix.model; report = r2; repaired = true; }
  }
  return { name: data.name, skillMd: data.skillMd, scripts: Array.isArray(data.scripts) ? data.scripts.filter((s) => s && s.path && s.content) : [], summary: data.summary, report, repaired, model };
}
module.exports = { forge };
