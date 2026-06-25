import { WEEKDAYS, campusColor } from "../config/constants.js";
import { buildInvigilationView, getCampusStaffMap } from "../analytics/invigilation.js";
import { rosterGrid } from "../components/card.js";
import { esc, unique } from "../utils/dom.js";
import { dataTable } from "../components/table.js";

export function renderInvigilationSection({ project, state }) {
  const allRows = project.getTimetableRows();
  const campuses = unique(allRows.map((r) => r.Campus)).sort();
  const campus = state.invigCampus || campuses[0] || "";
  const day = state.invigDay || "Monday";

  const staffView = buildInvigilationView(allRows, campus, day, project);
  const rowsHtml = staffView
    .map((entry) => {
      let statusBadge = entry.busy
        ? `<span class="badge busy">Busy</span>`
        : `<span class="badge free">Available</span>`;
      if (entry.testClashes.length) {
        statusBadge = `<span class="badge issue">Conflict</span>`;
      }
      return `<tr class="${entry.testClashes.length ? "row-busy" : entry.busy ? "row-busy" : "row-free"}">
        <td>${esc(entry.staff)}</td>
        <td>${statusBadge}</td>
        <td>${entry.sessions.length ? entry.sessions.map(esc).join("<br>") : "—"}</td>
        <td>${entry.testClashes.length ? entry.testClashes.map(esc).join("<br>") : "—"}</td>
        <td>${esc(entry.invigilationNote)}</td>
      </tr>`;
    })
    .join("");

  const roster = getCampusStaffMap(allRows);

  return `<details class="collapsible-section invigilation-panel">
    <summary>Who is available to invigilate? (${campuses.length ? esc(campus) : "pick campus"} · ${esc(day)})</summary>
    <div class="collapsible-body">
      <p class="muted small">Pick the same campus and day as your class test. Busy = teaching that day. Type any name in the table above — suggestions come from your timetable.</p>
      <div class="invig-controls">
        <label>Campus <select id="invig-campus">${campuses.map((c) => `<option value="${esc(c)}" ${c === campus ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label>Day <select id="invig-day">${WEEKDAYS.map((d) => `<option value="${d}" ${d === day ? "selected" : ""}>${d}</option>`).join("")}</select></label>
      </div>
      ${dataTable({ headers: ["Staff", "Status", "Teaching that day", "Test clashes", "Guidance"], rowsHtml })}
      <h4 class="section-heading">Staff by campus</h4>
      ${rosterGrid(Object.entries(roster), campusColor)}
    </div>
  </details>`;
}

export function bindInvigilationSection(container, { onInvigChange }) {
  document.getElementById("invig-campus")?.addEventListener("change", (e) => {
    onInvigChange(e.target.value, document.getElementById("invig-day")?.value || "Monday");
  });
  document.getElementById("invig-day")?.addEventListener("change", (e) => {
    onInvigChange(document.getElementById("invig-campus")?.value || "", e.target.value);
  });
}
