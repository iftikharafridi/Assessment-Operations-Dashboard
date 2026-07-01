import { esc, unique } from "../utils/dom.js";
import { dataTable, intro, statsBar } from "../components/table.js";
import { ASSESSMENT_STATUSES, displayAssessmentStatus } from "../config/constants.js";
import {
  applyAssessmentToPlans,
  buildAssessmentSummary,
  filterAssessmentEvents,
  getAssessmentTypeLabel,
  getClassTestCandidates,
  getCurrentTeachingWeek,
  getEventDueDate,
  getUpcomingAssessments,
  resolveSemesterStart,
} from "../analytics/assessment.js";
import { renderAssessmentSchedule, bindAssessmentScheduleView } from "../components/assessment-schedule.js";
import { renderSubTabs, bindSubTabs, ASSESSMENT_SUB_VIEWS } from "../components/tabs.js";
import { confirmAction } from "../components/dialog.js";
import { markDirty, setDirtySilent, setAssessmentSubView } from "../state/store.js";
import { displayAssessValue } from "../ui/inline-edit.js";

function typeBadge(type) {
  const classes = {
    classTest: "badge status-planning",
    presentation: "badge status-ready",
    submission: "badge status-not-planned",
    exam: "badge issue",
    other: "badge",
  };
  return `<span class="${classes[type] || "badge"}">${esc(getAssessmentTypeLabel(type))}</span>`;
}

function statusOptions(selected) {
  return ASSESSMENT_STATUSES.map(
    (s) => `<option value="${esc(s)}" ${selected === s ? "selected" : ""}>${esc(displayAssessmentStatus(s))}</option>`
  ).join("");
}

function renderAssessmentDetailDialog() {
  return `<dialog class="assess-detail-dialog" id="assess-detail-dialog">
    <article>
      <header><h3>Assessment details</h3>
        <button type="button" class="btn btn-small btn-muted" data-close-dialog>✕</button>
      </header>
      <dl class="dialog-dl"></dl>
    </article>
  </dialog>`;
}

function renderUpcomingPanel(events, project, semesterStart, filters, state) {
  const af = state.assessmentScheduleFilters || {};
  const upcomingFilters = {
    moduleCode: filters.moduleCode || "",
    type: af.type || "",
    classTestOnly: af.type === "classTest",
    weekFrom: Number(state.assessmentUpcomingWeeks || 4),
  };

  let filtered = filterAssessmentEvents(events, upcomingFilters);
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + upcomingFilters.weekFrom * 7);
  const maxStr = maxDate.toISOString().slice(0, 10);

  filtered = filtered
    .map((event) => ({ event, dueDate: getEventDueDate(event, semesterStart) }))
    .filter(({ dueDate }) => !dueDate || (dueDate >= todayStr && dueDate <= maxStr))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .map(({ event, dueDate }) => ({ ...event, effectiveDueDate: dueDate }));

  const types = unique(events.map((e) => e.assessmentType)).filter(Boolean);

  const rowsHtml = filtered
    .map(
      (event) => `<tr class="${event.suggestsClassTest ? "row-planned" : ""}">
        <td><strong>${esc(event.moduleCode)}</strong><br><span class="muted small">${esc(event.moduleName)}</span></td>
        <td>${esc(event.campus || "—")}</td>
        <td>${esc(event.assessmentCode || "—")}</td>
        <td>${esc(event.weekLabel)}</td>
        <td>${typeBadge(event.assessmentType)}</td>
        <td>${esc(event.effectiveDueDate || "—")}</td>
        <td>${esc(event.feedbackDate || event.feedbackText || "—")}</td>
        <td>${event.suggestsClassTest ? '<span class="badge status-planning">Yes</span>' : "—"}</td>
      </tr>`
    )
    .join("");

  return `<section class="panel-section">
    <div class="view-filters">
      <label>Weeks ahead
        <select id="upcoming-weeks">
          ${[2, 3, 4, 6, 8].map((w) => `<option value="${w}" ${upcomingFilters.weekFrom === w ? "selected" : ""}>${w} weeks</option>`).join("")}
        </select>
      </label>
      <label>Type
        <select id="upcoming-type">
          <option value="">All types</option>
          ${types.map((t) => `<option value="${esc(t)}" ${af.type === t ? "selected" : ""}>${esc(getAssessmentTypeLabel(t))}</option>`).join("")}
        </select>
      </label>
      <label class="filter-check"><input type="checkbox" id="upcoming-class-test" ${af.type === "classTest" ? "checked" : ""}> Class test candidates only</label>
    </div>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Module", "Campus", "Assessment", "Week", "Type", "Due date", "Feedback", "Class test"],
      rowsHtml: rowsHtml || `<tr><td colspan="8" class="muted">No deadlines in the selected window.</td></tr>`,
      className: "data-table table-pro",
    })}</div>
  </section>`;
}

function renderAllAssessmentsPanel(filtered, semesterStart) {
  const rowsHtml = filtered
    .map(
      (event) => {
        const due = getEventDueDate(event, semesterStart);
        return `<tr class="${event.suggestsClassTest ? "row-planned" : ""}" data-event-id="${esc(event.id)}">
          <td><strong>${esc(event.moduleCode)}</strong></td>
          <td>${esc(event.moduleName)}</td>
          <td>${esc(event.weekLabel)}</td>
          <td>${esc(event.assessmentCode || "—")}</td>
          <td>${typeBadge(event.assessmentType)}</td>
          <td>${esc(event.weight || "—")}</td>
          <td>${esc(due || "—")}</td>
          <td>${esc(event.feedbackDate || event.feedbackText || "—")}</td>
          <td>${event.suggestsClassTest ? "Yes" : "—"}</td>
          <td><button type="button" class="btn btn-small view-assess-detail" data-event-id="${esc(event.id)}">View details</button></td>
        </tr>`;
      }
    )
    .join("");

  return `<section class="panel-section">
    <p class="muted small">Search using the module filter in the sidebar. Long schedule text opens in a detail dialog.</p>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Module code", "Module name", "Week", "Assessment", "Type", "Weight", "Due date", "Feedback", "Class test", "Actions"],
      rowsHtml: rowsHtml || `<tr><td colspan="10" class="muted">No items match the current filter.</td></tr>`,
      className: "data-table table-pro",
    })}</div>
  </section>`;
}

function renderTrackingPanel(filtered, project, semesterStart) {
  const rowsHtml = filtered
    .map((event) => {
      const record = project.getAssessmentRecord(event.id);
      const due = getEventDueDate(event, semesterStart);
      return `<tr class="${event.suggestsClassTest ? "row-planned" : ""}" data-event-id="${esc(event.id)}">
        <td><strong>${esc(event.moduleCode)}</strong><br><span class="muted small">${esc(event.moduleName)}</span></td>
        <td>${esc(event.weekLabel)}</td>
        <td>${esc(event.assessmentCode || "—")}<br>${typeBadge(event.assessmentType)}</td>
        <td>${esc(due || "—")}</td>
        <td><select class="assess-status" data-id="${esc(event.id)}">${statusOptions(record.status)}</select></td>
        <td><textarea class="assess-tasks" data-id="${esc(event.id)}" rows="2" placeholder="To-do…">${esc(displayAssessValue(event.id, "tasks", record))}</textarea></td>
        <td><textarea class="assess-notes" data-id="${esc(event.id)}" rows="2" placeholder="Updates…">${esc(displayAssessValue(event.id, "notes", record))}</textarea></td>
      </tr>`;
    })
    .join("");

  return `<section class="panel-section assessment-tracking-panel">
    <p class="muted small">Operational tracking — status, tasks, and notes. Issues appear on the Dashboard.</p>
    <div class="table-scroll table-scroll-sticky">${dataTable({
      headers: ["Module", "Week", "Assessment", "Due", "Status", "Tasks / to-do", "Notes / updates"],
      rowsHtml: rowsHtml || `<tr><td colspan="7" class="muted">No items match the current filter.</td></tr>`,
      className: "data-table table-pro",
    })}</div>
  </section>`;
}

export function renderAssessmentView({ project, container, state, onUpdate }) {
  const events = project.getAssessmentEvents();
  const filters = state.filters || {};
  const subView = state.assessmentSubView || "timeline";

  if (!events.length) {
    container.innerHTML =
      intro("Upload your programme assessment schedule (Excel) using Add another file. Track class tests, submissions, presentations, tasks, and notes in one place.") +
      `<div class="alert alert-info" role="status">
        <strong>No assessment schedule loaded</strong>
        <p>Upload a file such as <em>2025-26 S3_QAHE_MSc_Assessment Schedule.xlsx</em> alongside your timetable.</p>
      </div>`;
    return;
  }

  let semesterStart = resolveSemesterStart(project, events);
  if (!project.getSemesterStartDate() && semesterStart) {
    project.setSemesterStartDate(semesterStart);
  }

  const currentWeek = getCurrentTeachingWeek(semesterStart);
  const filtered = filterAssessmentEvents(events, {
    moduleCode: filters.moduleCode,
    type: state.assessmentScheduleFilters?.type || "",
    classTestOnly: state.assessmentScheduleFilters?.type === "classTest",
  });

  const summary = buildAssessmentSummary(events);
  const classTests = getClassTestCandidates(filtered);

  const currentWeekHtml = currentWeek
    ? currentWeek.beforeSemester
      ? `<strong>Semester starts in ${currentWeek.daysUntilStart} days</strong> (${esc(semesterStart)})`
      : `<strong>${esc(currentWeek.weekLabel)}</strong> · w/c ${esc(currentWeek.weekCommencing)} · day ${currentWeek.dayInWeek} of 7`
    : `<span class="muted">Set semester start date below to calculate the current teaching week.</span>`;

  let subContent = "";
  if (subView === "timeline") {
    subContent =
      renderAssessmentSchedule(project, {
        view: state.assessmentScheduleView || "this-week",
        filters: state.assessmentScheduleFilters || {},
        weekOffset: state.assessmentScheduleWeekOffset || 0,
        moduleCode: filters.moduleCode || "",
      }) +
      `<div class="assessment-actions">
        <button type="button" class="btn btn-primary" id="apply-all-assessments">Apply class test weeks to plan</button>
        ${filters.moduleCode ? `<button type="button" class="btn" id="apply-module-assessment">Apply for ${esc(filters.moduleCode)} only</button>` : ""}
      </div>
      ${classTests.length ? `<p class="muted assessment-hint">Class test candidates: ${classTests.map((e) => `${e.moduleCode} (${e.weekLabel})`).join(", ")}</p>` : ""}`;
  } else if (subView === "upcoming") {
    subContent = renderUpcomingPanel(events, project, semesterStart, filters, state);
  } else if (subView === "all") {
    subContent = renderAllAssessmentsPanel(filtered, semesterStart);
  } else {
    subContent = renderTrackingPanel(filtered, project, semesterStart);
  }

  container.innerHTML =
    intro("Assessment schedule — use the views below to browse the timeline, upcoming deadlines, full list, or operational tracking.") +
    renderSubTabs(subView, ASSESSMENT_SUB_VIEWS) +
    `<section class="assessment-hub-panel">
      <h3 class="section-heading">Semester position</h3>
      <div class="semester-bar">
        <div class="semester-current">${currentWeekHtml}</div>
        <label class="semester-start-label">Semester start (Week 1 w/c)
          <input type="date" id="semester-start-date" value="${esc(semesterStart)}">
        </label>
      </div>
    </section>` +
    statsBar([
      `${summary.events} items`,
      `${summary.modules} modules`,
      `${summary.classTestCandidates} class tests`,
    ]) +
    subContent +
    renderAssessmentDetailDialog();

  bindSubTabs(container, "data-sub-tab", (view) => setAssessmentSubView(view));

  if (subView === "timeline") {
    bindAssessmentScheduleView(container, {
      onViewChange: (view) => onUpdate(view, "assessmentScheduleView"),
      onFilterChange: (filters) => onUpdate(filters, "assessmentScheduleFilters"),
      onWeekOffsetChange: (delta) => onUpdate(delta, "assessmentScheduleWeek"),
    });
    bindApplyButtons(container, project, filters, onUpdate);
  }

  if (subView === "tracking") bindTrackingFields(container, project, onUpdate);

  if (subView === "all") {
    const dlg = container.querySelector("#assess-detail-dialog");
    container.querySelectorAll(".view-assess-detail").forEach((btn) => {
      btn.onclick = () => {
        const event = events.find((e) => e.id === btn.dataset.eventId);
        if (!event || !dlg) return;
        dlg.querySelector("h3").textContent = `${event.moduleCode} — ${event.assessmentCode || "Assessment"}`;
        const dl = dlg.querySelector(".dialog-dl");
        if (dl) {
          dl.innerHTML = `
            <dt>Module</dt><dd>${esc(event.moduleName)}</dd>
            <dt>Week</dt><dd>${esc(event.weekLabel)}${event.weekCommencing ? ` (w/c ${esc(event.weekCommencing)})` : ""}</dd>
            <dt>Type</dt><dd>${typeBadge(event.assessmentType)}</dd>
            <dt>Weight</dt><dd>${esc(event.weight || "—")}</dd>
            <dt>Due</dt><dd>${esc(event.dueText || event.dueDate || "—")}</dd>
            <dt>Feedback</dt><dd>${esc(event.feedbackText || event.feedbackDate || "—")}</dd>
            <dt>Class test candidate</dt><dd>${event.suggestsClassTest ? "Yes" : "No"}</dd>
            <dt>Details</dt><dd class="assessment-details">${esc(event.rawText).replace(/\n/g, "<br>")}</dd>`;
        }
        dlg.showModal();
      };
    });
    dlg?.querySelector("[data-close-dialog]")?.addEventListener("click", () => dlg.close());
  }

  if (subView === "upcoming") {
    container.querySelector("#upcoming-weeks")?.addEventListener("change", (e) => {
      state.assessmentUpcomingWeeks = Number(e.target.value);
      onUpdate();
    });
    container.querySelector("#upcoming-type")?.addEventListener("change", (e) => {
      onUpdate({ ...state.assessmentScheduleFilters, type: e.target.value }, "assessmentScheduleFilters");
    });
    container.querySelector("#upcoming-class-test")?.addEventListener("change", (e) => {
      onUpdate({ ...(state.assessmentScheduleFilters || {}), type: e.target.checked ? "classTest" : "" }, "assessmentScheduleFilters");
    });
  }

  container.querySelector("#semester-start-date")?.addEventListener("change", (e) => {
    project.setSemesterStartDate(e.target.value);
    markDirty();
    onUpdate();
  });
}

function bindTrackingFields(container, project, onUpdate) {
  container.querySelectorAll(".assess-status").forEach((el) => {
    el.addEventListener("change", () => {
      project.setAssessmentRecord(el.dataset.id, { status: el.value });
      setDirtySilent();
      onUpdate(false);
    });
  });
}

function bindApplyButtons(container, project, filters, onUpdate) {
  container.querySelector("#apply-all-assessments")?.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Apply class test weeks from the assessment schedule? Seminar slots will be marked as class tests with test week and date filled in."
    );
    if (!ok) return;
    const result = applyAssessmentToPlans(project);
    showApplyResult(container, result);
    onUpdate();
  });

  container.querySelector("#apply-module-assessment")?.addEventListener("click", async () => {
    const code = filters.moduleCode;
    const ok = await confirmAction(
      `Apply assessment schedule for ${code}? Seminar slots for this module will be marked as class tests.`
    );
    if (!ok) return;
    const result = applyAssessmentToPlans(project, { moduleCode: code });
    showApplyResult(container, result);
    onUpdate();
  });
}

function showApplyResult(container, result) {
  let html = `<div class="alert ${result.warnings.length ? "alert-warning" : "alert-info"}" role="status">`;
  html += `<strong>Updated ${result.applied} seminar slot${result.applied === 1 ? "" : "s"}</strong>`;
  if (result.modules.length) html += `<p>Modules: ${result.modules.join(", ")}</p>`;
  if (result.warnings.length) {
    html += `<ul>${result.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;
  }
  html += "</div>";
  const existing = container.querySelector(".apply-result");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.className = "apply-result";
  div.innerHTML = html;
  container.querySelector(".assessment-hub-panel")?.prepend(div);
}
