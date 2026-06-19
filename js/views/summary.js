import { campusColor } from "../config/constants.js";
import { buildModuleSummary } from "../analytics/summary.js";
import { esc } from "../utils/dom.js";
import { dataTable } from "../components/table.js";

export function renderSummaryView({ rows, container }) {
  const entries = buildModuleSummary(rows);
  const rowsHtml = entries
    .map(
      (e) => `<tr>
        <td><span class="campus-dot" style="background:${campusColor(e.campus)}"></span>${esc(e.campus)}</td>
        <td><strong>${esc(e.code)}</strong><br><span class="muted">${esc(e.name)}</span></td>
        <td>${e.lectures}</td><td>${e.seminars}</td>
        <td>${[...e.groups].sort().join(", ") || "—"}</td>
        <td>${e.totalSize}</td>
        <td>${[...e.staff].map(esc).join(", ")}</td>
      </tr>`
    )
    .join("");

  container.innerHTML = dataTable({
    headers: ["Campus", "Module", "Lectures", "Seminars", "Groups", "Max class size", "Tutors"],
    rowsHtml,
  });
}
