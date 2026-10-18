// POST /api/validate { skillMd, dirName? }  -> spec check, no AI
const { readBody } = require("./_gemma");
const { validate } = require("../lib/validate");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try { const b = readBody(req); res.status(200).json(validate(String(b.skillMd || "").slice(0, 200000), b.dirName ? String(b.dirName) : undefined)); }
  catch (e) { res.status(400).json({ error: e.message }); }
};
