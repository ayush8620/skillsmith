// Validates a SKILL.md against the Agent Skills open standard (https://agentskills.io/specification).
// Zero dependencies: parses the small YAML subset the spec uses (scalars, quoted strings, one-level maps, | and > blocks).
const KNOWN = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];

function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function parseFrontmatter(md) {
  const text = String(md || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(text);
  if (!m) return { error: "SKILL.md must start with YAML frontmatter between two '---' lines", body: text };
  const fm = {}, lines = m[1].split("\n"), problems = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
    if (!kv) { problems.push(`Line ${i + 2}: can't parse "${line.trim().slice(0, 40)}"`); continue; }
    const key = kv[1], rest = kv[2].trim();
    if (rest === "" || rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i]);
      if (rest === "") {
        const map = {};
        for (const b of block) { const s = /^\s+([^:#]+):(.*)$/.exec(b); if (s) map[s[1].trim()] = unquote(s[2]); else if (b.trim()) problems.push(`"${key}" entry "${b.trim().slice(0, 40)}" is not key: value`); }
        fm[key] = map;
      } else fm[key] = block.map((b) => b.trim()).join(rest.startsWith(">") ? " " : "\n").trim();
    } else fm[key] = unquote(rest);
  }
  return { fm, body: m[2], problems };
}

// dirName: optional parent directory name; the spec says name must match it.
function validate(md, dirName) {
  const errors = [], warnings = [], tips = [];
  const { fm, body, error, problems = [] } = parseFrontmatter(md);
  if (error) return { valid: false, errors: [error], warnings, tips, fields: {}, stats: {} };
  problems.forEach((p) => errors.push(p));

  const name = fm.name;
  if (typeof name !== "string" || !name) errors.push("Missing required field: name");
  else {
    if (name.length > 64) errors.push(`name is ${name.length} characters (max 64)`);
    if (!/^[a-z0-9-]+$/.test(name)) errors.push("name may only contain lowercase letters, numbers and hyphens");
    if (/^-|-$/.test(name)) errors.push("name must not start or end with a hyphen");
    if (name.includes("--")) errors.push("name must not contain consecutive hyphens (--)");
    if (dirName && dirName !== name) errors.push(`name "${name}" must match the parent directory name "${dirName}"`);
  }
  const d = fm.description;
  if (typeof d !== "string" || !d.trim()) errors.push("Missing required field: description");
  else {
    if (d.length > 1024) errors.push(`description is ${d.length} characters (max 1024)`);
    if (d.length < 60) warnings.push("description is very short; say what the skill does AND when to use it");
    if (!/\b(use when|use this when|use for|when the user|use it when)\b/i.test(d)) warnings.push('description should say when to use the skill (e.g. "Use when …")');
  }
  if ("compatibility" in fm) {
    if (typeof fm.compatibility !== "string" || !fm.compatibility.trim()) errors.push("compatibility must be a non-empty string if provided");
    else if (fm.compatibility.length > 500) errors.push(`compatibility is ${fm.compatibility.length} characters (max 500)`);
  }
  if ("license" in fm && (typeof fm.license !== "string" || !fm.license.trim())) errors.push("license must be a short string");
  if ("metadata" in fm && (typeof fm.metadata !== "object" || Array.isArray(fm.metadata))) errors.push("metadata must be a map of string keys to string values");
  if ("allowed-tools" in fm && typeof fm["allowed-tools"] !== "string") errors.push("allowed-tools must be a space-separated string");
  Object.keys(fm).filter((k) => !KNOWN.includes(k)).forEach((k) => warnings.push(`Unknown top-level field "${k}" (put custom data under metadata)`));
  if (!("license" in fm)) tips.push("Add a license field (e.g. MIT) so others can reuse the skill");

  const lines = body.split("\n").length;
  if (!body.trim()) warnings.push("Body is empty; add instructions for the agent");
  if (lines > 500) warnings.push(`Body is ${lines} lines; the spec recommends under 500, so move details to references/`);
  if (!/^#{1,3} /m.test(body)) tips.push("Use Markdown headings (e.g. ## When to use, ## Steps) so agents can scan it");
  if (!/^#{1,3} .*(step|how|instruction|usage)/im.test(body)) tips.push("Add a ## Steps section with numbered instructions");
  if (/(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,})/.test(md)) errors.push("Looks like an API key/token is in the file; remove it and use an environment variable");
  return { valid: errors.length === 0, errors, warnings, tips, fields: fm, stats: { bodyLines: lines, descriptionLength: (d || "").length } };
}
module.exports = { validate, parseFrontmatter };
