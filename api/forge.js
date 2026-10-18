// POST /api/forge { idea, tools?, author? }  -> Gemma 4 writes a SKILL.md, then it is validated (and repaired once)
const { readBody } = require("./_gemma");
const { forge } = require("../lib/forge");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try { res.status(200).json(await forge(readBody(req))); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || "Something went wrong" }); }
};
