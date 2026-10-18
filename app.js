const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let last = null;

function tab(forge) {
  $("#forgeCard").style.display = forge ? "" : "none"; $("#checkCard").style.display = forge ? "none" : "";
  $("#tabForge").className = forge ? "" : "ghost"; $("#tabCheck").className = forge ? "ghost" : "";
}
$("#tabForge").onclick = () => tab(true); $("#tabCheck").onclick = () => tab(false);
$("#sample").onclick = () => { $("#idea").value = "Turn a CSV file into a quick data report: column types, missing values, summary stats and 3 chart suggestions. Use when the user shares or mentions a .csv file."; $("#tools").value = "python3, pandas"; $("#author").value = "Ayush Yadav"; };
$("#bad").onclick = () => { $("#md").value = "---\nname: PDF_Tools--v2\ndescription: Helps with PDFs.\nversion: 2\n---\nDo pdf stuff.\n"; $("#dir").value = "pdf-tools"; };

function reportHtml(r) {
  const li = (a, cls, icon) => a.map((x) => `<li><span class="${cls}">${icon}</span> ${esc(x)}</li>`).join("");
  return `<div class="row" style="justify-content:space-between"><span class="badge ${r.valid ? "ok" : "bad"}" style="font-size:14px">${r.valid ? "✔ Valid Agent Skill" : `✖ ${r.errors.length} error(s)`}</span>
    <span class="muted small">description ${r.stats.descriptionLength || 0}/1024 · body ${r.stats.bodyLines || 0} lines</span></div>
    <ul class="list" style="margin-top:10px">${li(r.errors, "bad", "✖")}${li(r.warnings, "warn", "⚠")}${li(r.tips, "muted", "💡")}${!r.errors.length && !r.warnings.length && !r.tips.length ? "<li>Everything looks great.</li>" : ""}</ul>`;
}
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" })); a.download = name; a.click(); }
document.addEventListener("click", async (e) => {
  if (!last) return;
  if (e.target.id === "copy") { await navigator.clipboard.writeText(last.skillMd); e.target.textContent = "Copied ✓"; }
  if (e.target.id === "dl") download("SKILL.md", last.skillMd);
  if (e.target.id === "edit") { $("#md").value = last.skillMd; $("#dir").value = last.name; tab(false); }
});

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({ error: "Server returned an invalid response" }));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

$("#forge").onclick = async () => {
  $("#error").innerHTML = "";
  const idea = $("#idea").value.trim();
  if (!idea) { $("#error").innerHTML = `<div class="err">Describe the skill first.</div>`; return; }
  const btn = $("#forge"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Gemma 4 is forging…`;
  $("#out").innerHTML = `<div class="empty">Writing SKILL.md and checking it against the spec…</div>`;
  try {
    const d = await post("/api/forge", { idea, tools: $("#tools").value.trim(), author: $("#author").value.trim() });
    last = d;
    const scripts = d.scripts.map((s) => `<div class="sec"><h3>${esc(d.name)}/${esc(s.path)}</h3><pre style="max-height:200px">${esc(s.content)}</pre></div>`).join("");
    $("#out").innerHTML = `<div class="row" style="justify-content:space-between"><div><div class="muted small">skills/</div><div style="font-size:20px;font-weight:800">${esc(d.name)}/</div></div>
      <div class="row"><button class="ghost" id="copy" type="button" style="padding:6px 10px;font-size:12px">Copy</button><button class="ghost" id="dl" type="button" style="padding:6px 10px;font-size:12px">Download</button><button class="ghost" id="edit" type="button" style="padding:6px 10px;font-size:12px">Edit & re-check</button></div></div>
      <p class="muted">${esc(d.summary)}</p>${reportHtml(d.report)}${d.repaired ? `<p class="small warn">Auto-repaired after the first draft failed validation.</p>` : ""}
      <div class="sec"><h3>SKILL.md</h3><pre style="max-height:420px">${esc(d.skillMd)}</pre></div>${scripts}
      <p class="muted small">Model: ${esc(d.model)} · Put the folder in your agent's skills directory.</p>`;
  } catch (e) { $("#out").innerHTML = `<div class="empty">No skill yet.</div>`; $("#error").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  finally { btn.disabled = false; btn.textContent = "Forge skill"; }
};

$("#check").onclick = async () => {
  $("#error2").innerHTML = "";
  try { const r = await post("/api/validate", { skillMd: $("#md").value, dirName: $("#dir").value.trim() }); $("#out").innerHTML = `<h2>Validation report</h2>${reportHtml(r)}`; }
  catch (e) { $("#error2").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
};
