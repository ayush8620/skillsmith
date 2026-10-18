---
name: skillsmith
description: Create new Agent Skills and validate existing SKILL.md files against the Agent Skills open standard (agentskills.io). Use when the user wants to write, scaffold, lint, check or fix an agent skill, or asks whether a SKILL.md is valid. Generation uses Google Gemma 4 (open-weight) via the Gemini API; validation works offline.
license: MIT
compatibility: Requires Node.js 18+. Creating skills needs network access to generativelanguage.googleapis.com and a GEMINI_API_KEY environment variable; validation needs neither.
metadata:
  author: Ayush Yadav
  version: "1.0.0"
---

# SkillSmith

Scaffolds spec-compliant Agent Skills from a one-line idea and lints SKILL.md files (name rules, description length and "when to use", compatibility limit, metadata map, body length, leaked secrets).
The zero-dependency CLI `cli.js` at the SkillSmith repo root does the work.

## When to use
- The user wants a new skill for a task ("make a skill that…").
- The user wants to know if a skill folder or SKILL.md follows the standard, or wants it fixed.

## Steps
1. To validate, run `node <path-to-skillsmith>/cli.js validate <skill-dir>` (several folders are allowed). Exit code 0 means valid.
2. Report every `error` and fix them in the user's SKILL.md: rename to lowercase-hyphen names, make the folder name match `name`, keep `description` at 1024 characters or fewer and include "Use when …". Then re-run step 1.
3. To create a skill, make sure `GEMINI_API_KEY` is set (never print it), then run
   `node <path-to-skillsmith>/cli.js new "<what it does and when to use it>" --out <skills-dir> --author "<name>"`.
4. Show the user the generated `SKILL.md`, then run step 1 on the new folder. Edit as needed; the CLI never overwrites an existing SKILL.md.

## Examples
- `node cli.js validate skills/commitcraft skills/skillsmith`
- `node cli.js new "Summarise a CSV file and suggest charts. Use when the user shares a .csv" --out ./skills`

## Notes
- Unknown top-level fields produce a warning; custom data belongs under `metadata`.
- The spec recommends a body under 500 lines; move long docs to `references/`.
