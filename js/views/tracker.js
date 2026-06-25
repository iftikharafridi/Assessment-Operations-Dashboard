import { PLAN_STATUSES, displayStatus } from "../config/constants.js";
import { parseGroups } from "../utils/groups.js";
import { esc, unique } from "../utils/dom.js";
import { dataTable, intro } from "../components/table.js";
import {
  updatePlan,
  clearAllPlans,
  normalizePlan,
  markAsClassTest,
  unmarkClassTest,
  planKey,
} from "../planner/plans.js";
import { confirmAction } from "../components/dialog.js";
import { getInvigilatorAvailability, getCampusStaffMap } from "../analytics/invigilation.js";
import { renderBulkBar, bindBulkBar } from "../planner/bulk.js";
import { sessionHasConflict } from "../analytics/dashboard.js";
import { moduleSeminarNotice } from "../analytics/filters.js";
import { renderInvigilationSection, bindInvigilationSection } from "./invigilation.js";

function statusOptions(selected) {
  return PLAN_STATUSES.map(
    (st) => `<option value="${st}" ${selected === st ? "selected" : ""}>${displayStatus(st)}</option>`
  ).join("");
}

export function renderTrackerView({ project, rows, container, state, onUpdate, onExport, onClear, onInvigChange }) {
  const allRows = project.getTimetableRows();
  const seminars = rows.filter((r) => r.Type === "Seminar");
  const showAll = state.trackerShowAll;
  const staffByCampus = getCampusStaffMap(allRows);

  const rowsHtml = seminars
    .filter((s) => showAll || normalizePlan(project.getPlan(planKey(s))).planned)
    .map((s) => {
      const sid = planKey(s);
      const plan = normalizePlan(project.getPlan(sid));
      const groups = parseGroups(s.Activity, s["Student Groups"]);
      const campusStaff = staffByCampus[s.Campus] || [];
      const invigSuggestions = unique([...campusStaff, plan.invigilator].filter(Boolean));
      const invigListId = `invig-list-${sid.replace(/[^a-z0-9-]/gi, "")}`;
      const invigWarning = plan.invigilator ? getInvigilatorAvailability(plan.invigilator, s, plan, allRows).warning : "";
      const conflict = sessionHasConflict(project, sid);

      return `<tr class="${plan.planned ? "row-planned" : "row-muted"}${conflict ? " row-issue" : ""}">
        <td><input type="checkbox" class="row-select" value="${esc(sid)}" aria-label="Select row"></td>
        <td>${esc(s.Campus)}</td>
        <td><strong>${esc(s["Module code"])}</strong> ${groups.letterGroups.length ? `(Grp ${esc(groups.letterGroups.join(" & "))})` : ""}<br><span class="muted">${esc(s["Module name"])}</span></td>
        <td>${esc(s.Weekday)} ${esc(s["Start time"])}–${esc(s["End time"])}</td>
        <td class="action-cell">${
          plan.planned
            ? `<button type="button" class="btn btn-small btn-muted unmark-test" data-id="${esc(sid)}">Remove</button>`
            : `<button type="button" class="btn btn-small btn-primary mark-test" data-id="${esc(sid)}">Mark as class test</button>`
        }</td>
        <td><input class="plan-field" data-id="${sid}" data-field="testWeek" value="${esc(plan.testWeek)}" placeholder="Week 8"></td>
        <td><input class="plan-field" data-id="${sid}" data-field="testDate" value="${esc(plan.testDate)}" placeholder="dd/mm/yyyy"></td>
        <td><input class="plan-field plan-time" data-id="${sid}" data-field="testStartTime" value="${esc(plan.testStartTime)}" placeholder="09:30"></td>
        <td><input class="plan-field plan-time" data-id="${sid}" data-field="testEndTime" value="${esc(plan.testEndTime)}" placeholder="11:30"></td>
        <td><input class="plan-field plan-narrow" data-id="${sid}" data-field="durationMinutes" value="${esc(plan.durationMinutes)}" placeholder="mins" title="Duration in minutes — end time updates automatically"></td>
        <td><select class="plan-field" data-id="${sid}" data-field="status">${statusOptions(plan.status)}</select></td>
        <td><input class="plan-field" data-id="${sid}" data-field="room" value="${esc(plan.room || s.Room || "")}"></td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="roomConfirmed" ${plan.roomConfirmed ? "checked" : ""} title="Room confirmed"></td>
        <td><input class="plan-field" data-id="${sid}" data-field="leadTutor" value="${esc(plan.leadTutor || s.Staff)}"></td>
        <td>
          <input class="plan-field invig-input" data-id="${sid}" data-field="invigilator" list="${esc(invigListId)}" value="${esc(plan.invigilator)}" placeholder="Type or pick a name">
          <datalist id="${esc(invigListId)}">${invigSuggestions.map((name) => `<option value="${esc(name)}">`).join("")}</datalist>
          ${invigWarning ? `<div class="field-warning">${esc(invigWarning)}</div>` : ""}
        </td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="paperReady" ${plan.paperReady ? "checked" : ""}></td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="lodReady" ${plan.lodReady ? "checked" : ""}></td>
        <td><input class="plan-field wide" data-id="${sid}" data-field="notes" value="${esc(plan.notes)}"></td>
      </tr>`;
    })
    .join("");

  const seminarNotice = state?.filters?.moduleCode
    ? moduleSeminarNotice(project.getTimetableRows(), state.filters, project)
    : "";

  const plannedSeminars = project.getTimetableRows().filter(
    (r) => r.Type === "Seminar" && normalizePlan(project.getPlan(planKey(r))).planned
  );
  const missingInvig = plannedSeminars.filter((s) => !normalizePlan(project.getPlan(planKey(s))).invigilator).length;
  const assignedInvig = unique(
    plannedSeminars.map((s) => normalizePlan(project.getPlan(planKey(s))).invigilator).filter(Boolean)
  );

  container.innerHTML = `
    <div class="tracker-actions">
      <button id="export-plans" class="btn btn-primary">Save workbook</button>
      <button id="clear-plans" class="btn btn-danger">Clear all plans</button>
    </div>
    ${intro("Mark seminar slots as class tests, set dates and rooms, and assign invigilators. Use <strong>Show all seminars</strong> to see every slot, or only planned tests by default.")}
    ${missingInvig ? `<div class="alert alert-warning" role="status"><strong>${missingInvig} planned test${missingInvig === 1 ? "" : "s"} without an invigilator</strong><p>Type a name in the Invigilator column or pick from suggestions (timetable staff). Open <strong>Who is available?</strong> below, then <strong>Save workbook</strong> so names are kept in the file.</p></div>` : ""}
    ${assignedInvig.length ? `<p class="muted small assigned-invig-summary"><strong>Assigned in this session:</strong> ${assignedInvig.map((n) => esc(n)).join(" · ")}</p>` : ""}
    ${seminarNotice ? `<div class="alert alert-info" role="status"><strong>Filter note</strong><p>${esc(seminarNotice)}</p></div>` : ""}
    ${renderBulkBar()}
    <div class="table-scroll">
    ${dataTable({
      headers: ["", "Campus", "Module", "Seminar slot", "Action", "Test week", "Test date", "Start", "End", "Duration", "Status", "Room", "Room OK", "Lead tutor", "Invigilator", "Paper", "LOD", "Notes"],
      rowsHtml,
      className: "data-table tracker-table",
    })}
    </div>
    <label class="show-all"><input type="checkbox" id="tracker-show-all" ${showAll ? "checked" : ""}> Show all seminars</label>
    ${renderInvigilationSection({ project, state })}`;

  bindRowActions(container, project, seminars, onUpdate);
  bindBulkBar(container, project, onUpdate);
  if (onInvigChange) bindInvigilationSection(container, { onInvigChange });

  document.getElementById("export-plans")?.addEventListener("click", onExport);
  document.getElementById("clear-plans")?.addEventListener("click", () => {
    if (confirmAction("Clear all class test plans? This cannot be undone until you save a new workbook.")) {
      clearAllPlans(project);
      onClear();
    }
  });
  document.getElementById("tracker-show-all")?.addEventListener("change", (e) => {
    onUpdate(e.target.checked, "showAll");
  });
}

function bindRowActions(container, project, seminars, onUpdate) {
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

  const persistField = (el) => {
    updatePlan(project, el.dataset.id, { [el.dataset.field]: el.value, planned: true });
    onUpdate(false);
  };

  container.querySelectorAll(".plan-field").forEach((el) => {
    el.onchange = () => persistField(el);
    if (el.tagName === "INPUT") el.oninput = () => persistField(el);
  });

  container.querySelectorAll(".plan-check").forEach((el) => {
    el.onchange = () => {
      updatePlan(project, el.dataset.id, { [el.dataset.field]: el.checked, planned: true });
      onUpdate(false);
    };
  });
}
