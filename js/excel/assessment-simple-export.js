import { REPORT_ASSESSMENT_SCHEDULE_SIMPLE } from "../config/constants.js";
import { enrichAssessmentEvent, SCHEDULING_BASIS_LABELS } from "./assessment-format.js";
import { normalizeSemesterNumber } from "./assessment-parser.js";

export const ASSESSMENT_SCHEDULE_SIMPLE_SHEET = REPORT_ASSESSMENT_SCHEDULE_SIMPLE;

export const ASSESSMENT_SCHEDULE_SIMPLE_COLUMNS = [
  "Module code",
  "Module name",
  "Semester",
  "Teaching week",
  "Assessment",
  "Assessment format",
  "Weight",
  "Scheduling basis",
  "W/C",
  "Fixed deadline",
  "Feedback",
  "Source wording",
];

function toExcelDate(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "";
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d;
}

export function buildSimplifiedAssessmentExportRows(project) {
  const events = project.getAssessmentEvents?.() || [];
  return events
    .map((e) => enrichAssessmentEvent(e))
    .sort(
      (a, b) =>
        String(a.exactDueDate || a.weekCommencing || "9999").localeCompare(
          String(b.exactDueDate || b.weekCommencing || "9999")
        ) || String(a.moduleCode).localeCompare(String(b.moduleCode))
    )
    .map((e) => {
      const basis = e.schedulingBasis || "notSpecified";
      const showWc = basis !== "fixedDeadline";
      const showFixed = basis !== "weekCommencing";
      return {
        "Module code": e.moduleCode,
        "Module name": e.moduleName,
        Semester: normalizeSemesterNumber(e.semester),
        "Teaching week": e.weekLabel,
        Assessment: e.assessmentCode || e.title,
        "Assessment format": e.assessmentFormat,
        Weight: e.weight,
        "Scheduling basis": SCHEDULING_BASIS_LABELS[basis] || basis,
        "W/C": showWc && e.weekCommencing ? toExcelDate(e.weekCommencing) : "",
        "Fixed deadline": showFixed && e.exactDueDate ? toExcelDate(e.exactDueDate) : "",
        Feedback: e.feedbackText || e.feedbackDate || "",
        "Source wording": e.rawText || "",
      };
    });
}

/** CSV string for Obsidian / spreadsheet import. */
export function buildSimplifiedAssessmentCsv(project) {
  const rows = buildSimplifiedAssessmentExportRows(project).map((r) => ({
    ...r,
    "W/C": r["W/C"] instanceof Date ? formatIso(r["W/C"]) : r["W/C"],
    "Fixed deadline":
      r["Fixed deadline"] instanceof Date ? formatIso(r["Fixed deadline"]) : r["Fixed deadline"],
  }));
  const headers = ASSESSMENT_SCHEDULE_SIMPLE_COLUMNS;
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function formatIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildObsidianAssessmentMarkdown({ csvFilename = "Assessment Schedule Simplified.csv" } = {}) {
  return `---
tags:
  - assessment-schedule
  - operations
---

# Assessment Schedule (Simplified)

> [!info] How to use
> Keep this note and \`${csvFilename}\` in the **same Obsidian folder**.
> Install the **Dataview** community plugin and enable **JavaScript queries**.

\`\`\`dataviewjs
const CSV_NAME = "${csvFilename}";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => {
    if (row.length && row.some(c => String(c).trim() !== "")) rows.push(row);
    row = [];
  };
  const s = String(text ?? "").replace(/^\\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") pushCell();
    else if (ch === "\\n") { pushCell(); pushRow(); }
    else if (ch === "\\r") { /* skip */ }
    else cell += ch;
  }
  pushCell();
  pushRow();
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    return obj;
  });
}

function timingLabel(r) {
  const basis = String(r["Scheduling basis"] || "");
  const wc = String(r["W/C"] || "").slice(0, 10);
  const fixed = String(r["Fixed deadline"] || "").slice(0, 10);
  if (/mixed/i.test(basis)) {
    return fixed ? \`Deadline: \${fixed} · W/C: \${wc || "—"}\` : \`W/C \${wc || "—"}\`;
  }
  if (/week commencing/i.test(basis)) return wc ? \`W/C \${wc}\` : "W/C —";
  if (/fixed/i.test(basis)) return fixed || "—";
  return fixed || (wc ? \`W/C \${wc}\` : "—");
}

function sortKey(r) {
  return String(r["Fixed deadline"] || r["W/C"] || "9999-99-99").slice(0, 10);
}

const raw = await dv.io.load(CSV_NAME);
if (!raw) {
  dv.paragraph("⚠️ Could not load **" + CSV_NAME + "**. Place the CSV next to this note (same folder) and check the filename.");
} else {
  let data = parseCsv(raw);
  const modules = [...new Set(data.map(r => r["Module code"]).filter(Boolean))].sort();
  const semesters = [...new Set(data.map(r => String(r.Semester || "")).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const formats = [...new Set(data.map(r => r["Assessment format"]).filter(Boolean))].sort();
  const timings = ["Week commencing", "Fixed deadline", "Mixed", "Not specified"];

  const wrap = dv.el("div", "", { cls: "aod-dash" });
  wrap.innerHTML = \`
    <style>
      .aod-dash { --aod-bg: var(--background-primary); --aod-card: var(--background-secondary); --aod-text: var(--text-normal); --aod-muted: var(--text-muted); --aod-border: var(--background-modifier-border); --aod-accent: var(--interactive-accent); font-family: var(--font-interface); color: var(--aod-text); }
      .aod-filters { display:flex; flex-wrap:wrap; gap:0.5rem; margin: 0.75rem 0 1rem; align-items:end; }
      .aod-filters label { display:flex; flex-direction:column; gap:0.2rem; font-size:0.75rem; color: var(--aod-muted); }
      .aod-filters input, .aod-filters select { padding:0.35rem 0.45rem; border:1px solid var(--aod-border); border-radius:6px; background: var(--aod-bg); color: var(--aod-text); min-width: 8rem; }
      .aod-kpis { display:grid; grid-template-columns: repeat(auto-fill,minmax(120px,1fr)); gap:0.65rem; margin-bottom:1rem; }
      .aod-kpi { background: var(--aod-card); border:1px solid var(--aod-border); border-radius:8px; padding:0.65rem 0.75rem; }
      .aod-kpi strong { display:block; font-size:1.35rem; }
      .aod-kpi span { font-size:0.72rem; color: var(--aod-muted); text-transform:uppercase; letter-spacing:0.03em; }
      .aod-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
      .aod-table th, .aod-table td { border:1px solid var(--aod-border); padding:0.4rem 0.5rem; vertical-align:top; }
      .aod-table th { background: var(--aod-card); text-align:left; }
      .aod-wc { color: #b45309; }
      .aod-fixed { color: #1d4ed8; }
      .aod-mixed { color: #047857; }
    </style>
    <div class="aod-filters">
      <label>Search<input type="search" id="aod-search" placeholder="Module, assessment…"></label>
      <label>Module<select id="aod-module"><option value="">All</option>\${modules.map(m=>\`<option>\${m}</option>\`).join("")}</select></label>
      <label>Semester<select id="aod-sem"><option value="">All</option>\${semesters.map(s=>\`<option>\${s}</option>\`).join("")}</select></label>
      <label>Format<select id="aod-fmt"><option value="">All</option>\${formats.map(f=>\`<option>\${f}</option>\`).join("")}</select></label>
      <label>Timing<select id="aod-timing"><option value="">All</option>\${timings.map(t=>\`<option>\${t}</option>\`).join("")}</select></label>
    </div>
    <div class="aod-kpis" id="aod-kpis"></div>
    <div id="aod-table"></div>
  \`;

  const q = (id) => wrap.querySelector("#" + id);
  function render() {
    const search = (q("aod-search").value || "").toLowerCase();
    const mod = q("aod-module").value;
    const sem = q("aod-sem").value;
    const fmt = q("aod-fmt").value;
    const timing = q("aod-timing").value;
    let rows = data.filter(r => {
      if (mod && r["Module code"] !== mod) return false;
      if (sem && String(r.Semester) !== sem) return false;
      if (fmt && r["Assessment format"] !== fmt) return false;
      if (timing && String(r["Scheduling basis"]) !== timing) return false;
      if (search) {
        const hay = [r["Module code"], r["Module name"], r.Assessment, r["Assessment format"]].join(" ").toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    }).sort((a,b) => sortKey(a).localeCompare(sortKey(b)) || String(a["Module code"]).localeCompare(String(b["Module code"])));

    const wc = rows.filter(r => /week commencing/i.test(r["Scheduling basis"]||"")).length;
    const fixed = rows.filter(r => /fixed/i.test(r["Scheduling basis"]||"")).length;
    const mixed = rows.filter(r => /mixed/i.test(r["Scheduling basis"]||"")).length;
    q("aod-kpis").innerHTML = \`
      <div class="aod-kpi"><strong>\${rows.length}</strong><span>Total</span></div>
      <div class="aod-kpi"><strong>\${wc}</strong><span>W/C</span></div>
      <div class="aod-kpi"><strong>\${fixed}</strong><span>Fixed</span></div>
      <div class="aod-kpi"><strong>\${mixed}</strong><span>Mixed</span></div>\`;

    const cls = (basis) => /mixed/i.test(basis) ? "aod-mixed" : /fixed/i.test(basis) ? "aod-fixed" : "aod-wc";
    q("aod-table").innerHTML = \`<table class="aod-table"><thead><tr>
      <th>Module</th><th>Sem</th><th>Week</th><th>Assessment</th><th>Format</th><th>Weight</th><th>Timing</th>
    </tr></thead><tbody>\${rows.map(r => \`<tr>
      <td><strong>\${r["Module code"]||""}</strong><br><span style="color:var(--text-muted);font-size:0.8em">\${r["Module name"]||""}</span></td>
      <td>\${r.Semester||""}</td>
      <td>\${r["Teaching week"]||""}</td>
      <td>\${r.Assessment||""}</td>
      <td>\${r["Assessment format"]||""}</td>
      <td>\${r.Weight||""}</td>
      <td class="\${cls(r["Scheduling basis"]||"")}">\${timingLabel(r)}</td>
    </tr>\`).join("") || \`<tr><td colspan="7">No rows match the filters.</td></tr>\`}</tbody></table>\`;
  }

  ["aod-search","aod-module","aod-sem","aod-fmt","aod-timing"].forEach(id => {
    q(id).addEventListener("input", render);
    q(id).addEventListener("change", render);
  });
  render();
}
\`\`\`
`;
}
