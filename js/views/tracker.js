import { PLAN_STATUSES, displayStatus } from "../config/constants.js";
import { parseGroups } from "../utils/groups.js";
import { esc, unique } from "../utils/dom.js";
import { dataTable, intro, bindTableSort, toggleSortKey } from "../components/table.js";
import { sortTrackerRows, TRACKER_SORT_DEFAULT } from "../analytics/tracker-sort.js";
import { setTrackerSort } from "../state/store.js";
import {
  updatePlan,
  clearAllPlans,
  normalizePlan,
  markAsClassTest,
  unmarkClassTest,
  planKey,
} from "../planner/plans.js";
import { confirmAction } from "../components/dialog.js";
import { getInvigilatorAvailability } from "../analytics/invigilation.js";
import { renderBulkBar, bindBulkBar } from "../planner/bulk.js";
import { sessionHasConflict } from "../analytics/dashboard.js";
import { moduleSeminarNotice } from "../analytics/filters.js";
import { renderInvigilationSection, bindInvigilationSection } from "./invigilation.js";
import { displayPlanValue } from "../ui/inline-edit.js";

function statusOptions(selected) {
  return PLAN_STATUSES.map(
    (st) => `<option value="${st}" ${selected === st ? "selected" : ""}>${displayStatus(st)}</option>`
  ).join("");
}

export function renderTrackerView({ project, rows, container, state, onUpdate, onExport, onClear, onInvigChange }) {
  const allRows = project.getTimetableRows();
  const seminars = rows.filter((r) => r.Type === "Seminar");
  const showAll = state.trackerShowAll;

  const sort = state.trackerSort || TRACKER_SORT_DEFAULT;
  const visibleSeminars = seminars.filter(
    (s) => showAll || normalizePlan(project.getPlan(planKey(s))).planned
  );
  const sortedSeminars = sortTrackerRows(visibleSeminars, project, sort);

  const rowsHtml = sortedSeminars
    .map((s) => {
      const sid = planKey(s);
      const plan = normalizePlan(project.getPlan(sid));
      const groups = parseGroups(s.Activity, s["Student Groups"]);
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
        <td><input class="plan-field" data-id="${sid}" data-field="testWeek" value="${esc(displayPlanValue(sid, "testWeek", plan, s))}" placeholder="Week 8"></td>
        <td><input class="plan-field" data-id="${sid}" data-field="testDate" value="${esc(displayPlanValue(sid, "testDate", plan, s))}" placeholder="dd/mm/yyyy"></td>
        <td><input class="plan-field plan-time" data-id="${sid}" data-field="testStartTime" value="${esc(displayPlanValue(sid, "testStartTime", plan, s))}" placeholder="09:30"></td>
        <td><input class="plan-field plan-time" data-id="${sid}" data-field="testEndTime" value="${esc(displayPlanValue(sid, "testEndTime", plan, s))}" placeholder="11:30"></td>
        <td><input class="plan-field plan-narrow" data-id="${sid}" data-field="durationMinutes" value="${esc(displayPlanValue(sid, "durationMinutes", plan, s))}" placeholder="mins" title="Duration in minutes — end time updates automatically"></td>
        <td><select class="plan-field" data-id="${sid}" data-field="status">${statusOptions(plan.status)}</select></td>
        <td><input class="plan-field" data-id="${sid}" data-field="room" value="${esc(displayPlanValue(sid, "room", plan, s))}"></td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="roomConfirmed" ${plan.roomConfirmed ? "checked" : ""} title="Room confirmed"></td>
        <td><input class="plan-field" data-id="${sid}" data-field="leadTutor" value="${esc(displayPlanValue(sid, "leadTutor", plan, s))}"></td>
        <td>
          <input class="plan-field invig-input" data-id="${sid}" data-field="invigilator" value="${esc(displayPlanValue(sid, "invigilator", plan, s))}" placeholder="Type a name" autocomplete="off" spellcheck="false">
          ${invigWarning ? `<div class="field-warning">${esc(invigWarning)}</div>` : ""}
        </td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="paperReady" ${plan.paperReady ? "checked" : ""}></td>
        <td><input type="checkbox" class="plan-check" data-id="${sid}" data-field="lodReady" ${plan.lodReady ? "checked" : ""}></td>
        <td><input class="plan-field wide" data-id="${sid}" data-field="notes" value="${esc(displayPlanValue(sid, "notes", plan, s))}"></td>
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
    ${intro("Mark seminar slots as class tests, set dates and rooms, and assign invigilators. <strong>Click a column heading</strong> to sort. Use <strong>Show all seminars</strong> to see every slot, or only planned tests by default.")}
    ${missingInvig ? `<div class="alert alert-warning" role="status"><strong>${missingInvig} planned test${missingInvig === 1 ? "" : "s"} without an invigilator</strong><p>Type a name in the Invigilator column (tab away to save). Open <strong>Who is available?</strong> below for staff suggestions, then <strong>Save workbook</strong>.</p></div>` : ""}
    ${assignedInvig.length ? `<p class="muted small assigned-invig-summary"><strong>Assigned in this session:</strong> ${assignedInvig.map((n) => esc(n)).join(" · ")}</p>` : ""}
    ${seminarNotice ? `<div class="alert alert-info" role="status"><strong>Filter note</strong><p>${esc(seminarNotice)}</p></div>` : ""}
    ${renderBulkBar()}
    <div class="table-scroll">
    ${dataTable({
      headers: [
        { label: "" },
        { label: "Campus", sortKey: "campus" },
        { label: "Module", sortKey: "module" },
        { label: "Seminar slot", sortKey: "seminarSlot" },
        { label: "Action" },
        { label: "Test week", sortKey: "testWeek" },
        { label: "Test date", sortKey: "testDate" },
        { label: "Start", sortKey: "testStartTime" },
        { label: "End", sortKey: "testEndTime" },
        { label: "Duration", sortKey: "duration" },
        { label: "Status", sortKey: "status" },
        { label: "Room", sortKey: "room" },
        { label: "Room OK" },
        { label: "Lead tutor", sortKey: "leadTutor" },
        { label: "Invigilator", sortKey: "invigilator" },
        { label: "Paper" },
        { label: "LOD" },
        { label: "Notes", sortKey: "notes" },
      ],
      rowsHtml,
      className: "data-table tracker-table",
      sort,
    })}
    </div>
    <label class="show-all"><input type="checkbox" id="tracker-show-all" ${showAll ? "checked" : ""}> Show all seminars</label>
    ${renderInvigilationSection({ project, state })}`;

  bindRowActions(container, project, seminars, onUpdate);
  bindBulkBar(container, project, onUpdate);
  bindTableSort(container, (sortKey) => {
    setTrackerSort(toggleSortKey(sort, sortKey));
  });
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

  const persistField = (el, { notify = true } = {}) => {
    const field = el.dataset.field;
    const id = el.dataset.id;
    const prior = normalizePlan(project.getPlan(id))[field];
    const next = el.value;
    if (String(prior ?? "") === String(next ?? "")) return;
    updatePlan(project, id, { [field]: next, planned: true }, { notify });
    onUpdate(false);
  };

  container.querySelectorAll(".plan-field").forEach((el) => {
    if (el.tagName === "SELECT") {
      el.onchange = () => {
        persistField(el);
        onUpdate(true);
      };
    }
  });

  container.querySelectorAll(".plan-check").forEach((el) => {
    el.onchange = () => {
      updatePlan(project, el.dataset.id, { [el.dataset.field]: el.checked, planned: true });
      onUpdate(false);
    };
  });
}
