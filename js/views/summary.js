import { campusColor } from "../config/constants.js";
import { buildModuleSummary } from "../analytics/summary.js";
import { esc } from "../utils/dom.js";

/** Compact module list for the Overview tab. */
export function renderModuleSummarySection(rows) {
  const entries = buildModuleSummary(rows);
  if (!entries.length) return "";

  const rowsHtml = entries
    .map(
      (e) => `<tr>
        <td><span class="campus-dot" style="background:${campusColor(e.campus)}"></span>${esc(e.campus)}</td>
        <td><strong>${esc(e.code)}</strong><br><span class="muted">${esc(e.name)}</span></td>
        <td>${e.lectures}</td><td>${e.seminars}</td>
        <td>${[...e.groups].sort().join(", ") || "—"}</td>
        <td>${e.totalSize}</td>
      </tr>`
    )
    .join("");

  return `<details class="collapsible-section">
    <summary>Modules by campus (${entries.length})</summary>
    <div class="collapsible-body table-scroll">
      <table class="data-table">
        <thead><tr><th>Campus</th><th>Module</th><th>Lectures</th><th>Seminars</th><th>Groups</th><th>Max size</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </details>`;
}
