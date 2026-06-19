import { campusColor, WEEKDAYS, displayStatus, campusDisplayName } from "../config/constants.js";
import { parseGroups } from "../utils/groups.js";
import { esc, unique } from "../utils/dom.js";
import { timeToMinutes } from "../utils/time.js";
import { dataTable, intro } from "../components/table.js";
import { markAsClassTest, unmarkClassTest, normalizePlan, planKey } from "../planner/plans.js";
import { renderBulkBar, bindBulkBar } from "../planner/bulk.js";
import { moduleSeminarNotice } from "../analytics/filters.js";

export function renderSeminarsView({ project, rows, container, onUpdate, state }) {
  const seminars = rows
    .filter((r) => r.Type === "Seminar")
    .sort((a, b) => {
      const c = a.Campus.localeCompare(b.Campus);
      if (c) return c;
      const d = WEEKDAYS.indexOf(a.Weekday) - WEEKDAYS.indexOf(b.Weekday);
      if (d) return d;
      return timeToMinutes(a["Start time"]) - timeToMinutes(b["Start time"]);
    });

  const rowsHtml = seminars
    .map((s) => {
      const sid = planKey(s);
      const groups = parseGroups(s.Activity, s["Student Groups"]);
      const plan = normalizePlan(project.getPlan(sid));
      const statusClass = plan.status.replace(/\s+/g, "-").toLowerCase();
      return `<tr class="${plan.planned ? "row-planned" : ""}">
        <td><input type="checkbox" class="row-select" value="${esc(sid)}"></td>
        <td><span class="campus-dot" style="background:${campusColor(s.Campus)}"></span>${esc(campusDisplayName(s.Campus))}</td>
        <td><strong>${esc(s["Module code"])}</strong><br><span class="muted">${esc(s["Module name"])}</span></td>
        <td>${esc(s.Weekday)}</td>
        <td>${esc(s["Start time"])} – ${esc(s["End time"])}</td>
        <td>${groups.letterGroups.length ? `Grp ${esc(groups.letterGroups.join(" & "))}` : "—"}<br><span class="muted small">${groups.admissionGroups.map(esc).join("<br>")}</span></td>
        <td>${esc(s.Size)}</td>
        <td>${esc(s.Staff)}</td>
        <td><span class="badge status-${statusClass}">${esc(displayStatus(plan.status))}</span></td>
        <td>${
          plan.planned
            ? `<button type="button" class="btn btn-small btn-muted unmark-test" data-id="${esc(sid)}">Remove</button>`
            : `<button type="button" class="btn btn-small btn-primary mark-test" data-id="${esc(sid)}">Mark as class test</button>`
        }</td>
      </tr>`;
    })
    .join("");

  const seminarNotice = state?.filters?.moduleCode
    ? moduleSeminarNotice(project.getTimetableRows(), state.filters, project)
    : "";

  container.innerHTML =
    intro("Seminar slots are the usual choice for class tests. Select several rows to apply bulk actions, or mark individual modules as class tests.") +
    (seminarNotice
      ? `<div class="alert alert-info" role="status"><strong>London / lecture-only campuses</strong><p>${esc(seminarNotice)}</p></div>`
      : "") +
    renderBulkBar() +
    dataTable({
      headers: ["", "Campus", "Module", "Day", "Time", "Groups", "Size", "Tutor", "Status", "Action"],
      rowsHtml,
    });

  container.querySelectorAll(".mark-test").forEach((btn) => {
    btn.onclick = () => {
      const row = seminars.find((s) => planKey(s) === btn.dataset.id);
      markAsClassTest(project, btn.dataset.id, row?.Staff, row);
      onUpdate();
    };
  });
  container.querySelectorAll(".unmark-test").forEach((btn) => {
    btn.onclick = () => {
      unmarkClassTest(project, btn.dataset.id);
      onUpdate();
    };
  });
  bindBulkBar(container, project, onUpdate);
}
