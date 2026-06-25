import { esc } from "../utils/dom.js";
import { dataTable, intro, statsBar } from "../components/table.js";
import { ASSESSMENT_STATUSES, displayAssessmentStatus } from "../config/constants.js";
import {
  applyAssessmentToPlans,
  buildAssessmentSummary,
  buildAssessmentTimeline,
  filterAssessmentEvents,
  getAssessmentTypeLabel,
  getClassTestCandidates,
  getCurrentTeachingWeek,
  getEventDueDate,
  getUpcomingAssessments,
  resolveSemesterStart,
} from "../analytics/assessment.js";
import { renderAssessmentTimeline, renderUpcomingList } from "../components/assessment-timeline.js";
import { renderActionItemsPanel } from "../components/action-items.js";
import { confirmAction } from "../components/dialog.js";
import { markDirty } from "../state/store.js";
import { buildActionItems } from "../analytics/assessment.js";

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

export function renderAssessmentView({ project, container, state, onUpdate }) {
  const events = project.getAssessmentEvents();
  const filters = state.filters || {};
  const filtered = filterAssessmentEvents(events, {
    moduleCode: filters.moduleCode,
    classTestOnly: false,
  });

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
  const timeline = buildAssessmentTimeline(events, {
    semesterStart,
    currentWeek,
    moduleCode: filters.moduleCode || null,
  });
  const upcoming = getUpcomingAssessments(events, {
    moduleCode: filters.moduleCode || null,
    semesterStart,
    limit: 8,
  });

  const summary = buildAssessmentSummary(events);
  const classTests = getClassTestCandidates(filtered);
  const actionItems = buildActionItems(project);

  const trackingRowsHtml = filtered
    .map((event) => {
      const record = project.getAssessmentRecord(event.id);
      const due = getEventDueDate(event, semesterStart);
      return `<tr class="${event.suggestsClassTest ? "row-planned" : ""}" data-event-id="${esc(event.id)}">
        <td><strong>${esc(event.moduleCode)}</strong><br><span class="muted small">${esc(event.moduleName)}</span></td>
        <td>${esc(event.weekLabel)}${event.weekCommencing ? `<br><span class="muted small">${esc(event.weekCommencing)}</span>` : ""}</td>
        <td>${esc(event.assessmentCode || "—")}<br>${typeBadge(event.assessmentType)}</td>
        <td>${esc(due || "—")}<br><span class="muted small">${esc(event.dueText || "").slice(0, 80)}</span></td>
        <td><select class="assess-status" data-id="${esc(event.id)}">${statusOptions(record.status)}</select></td>
        <td><textarea class="assess-tasks" data-id="${esc(event.id)}" rows="2" placeholder="To-do: e.g. Prepare paper, book room…">${esc(record.tasks)}</textarea></td>
        <td><textarea class="assess-notes" data-id="${esc(event.id)}" rows="2" placeholder="Updates: how it went, issues…">${esc(record.notes)}</textarea></td>
      </tr>`;
    })
    .join("");

  const scheduleRowsHtml = filtered
    .map((event) => {
      const due = [event.dueText, event.dueDate ? `(${event.dueDate})` : ""].filter(Boolean).join(" ");
      return `<tr class="${event.suggestsClassTest ? "row-planned" : ""}">
        <td><strong>${esc(event.moduleCode)}</strong></td>
        <td>${esc(event.weekLabel)}</td>
        <td>${esc(event.assessmentCode || "—")}</td>
        <td>${typeBadge(event.assessmentType)}</td>
        <td>${esc(event.weight || "—")}</td>
        <td>${esc(due || "—")}</td>
        <td class="assessment-details">${esc(event.rawText).replace(/\n/g, "<br>")}</td>
      </tr>`;
    })
    .join("");

  const currentWeekHtml = currentWeek
    ? currentWeek.beforeSemester
      ? `<strong>Semester starts in ${currentWeek.daysUntilStart} days</strong> (${esc(semesterStart)})`
      : `<strong>${esc(currentWeek.weekLabel)}</strong> · w/c ${esc(currentWeek.weekCommencing)} · day ${currentWeek.dayInWeek} of 7`
    : `<span class="muted">Set semester start date below to calculate the current teaching week.</span>`;

  container.innerHTML =
    intro("Semester timeline, coursework deadlines, tasks and notes. Apply class test weeks to the Class tests tab.") +
    renderActionItemsPanel(actionItems) +
    `<section class="assessment-hub-panel">
      <h3 class="section-heading">Semester position</h3>
      <div class="semester-bar">
        <div class="semester-current">${currentWeekHtml}</div>
        <label class="semester-start-label">Semester start (Week 1 w/c)
          <input type="date" id="semester-start-date" value="${esc(semesterStart)}">
        </label>
      </div>
    </section>` +
    `<section class="assessment-hub-panel">
      <h3 class="section-heading">Assessment timeline</h3>
      ${renderAssessmentTimeline(timeline)}
    </section>` +
    `<section class="assessment-hub-panel">
      <h3 class="section-heading">Coming up next</h3>
      ${renderUpcomingList(upcoming, project)}
    </section>` +
    statsBar([
      `${summary.events} items`,
      `${summary.modules} modules`,
      `${summary.classTestCandidates} class tests`,
      `${upcoming.length} upcoming`,
    ]) +
    `<div class="assessment-actions">
      <button type="button" class="btn btn-primary" id="apply-all-assessments">Apply class test weeks to plan</button>
      ${filters.moduleCode ? `<button type="button" class="btn" id="apply-module-assessment">Apply for ${esc(filters.moduleCode)} only</button>` : ""}
    </div>
    ${classTests.length ? `<p class="muted assessment-hint">Class test candidates: ${classTests.map((e) => `${e.moduleCode} (${e.weekLabel})`).join(", ")}</p>` : ""}` +
    `<section class="assessment-hub-panel assessment-tracking-panel">
      <h3 class="section-heading">Tasks &amp; notes — add your to-do items here</h3>
      <p class="muted small">Set <strong>Status</strong> (e.g. Issue), type <strong>Tasks / to-do</strong>, and <strong>Notes / updates</strong> for each row. These appear in <strong>Issues &amp; to-do</strong> above and on Overview after you save.</p>
      ${dataTable({
        headers: ["Module", "Week", "Assessment", "Due", "Status", "Tasks / to-do", "Notes / updates"],
        rowsHtml: trackingRowsHtml || `<tr><td colspan="7" class="muted">No items match the current filter.</td></tr>`,
      })}
    </section>` +
    `<section class="assessment-hub-panel">
      <h3 class="section-heading">Full schedule details</h3>
      ${dataTable({
        headers: ["Module", "Week", "CW", "Type", "Weight", "Due", "Details"],
        rowsHtml: scheduleRowsHtml,
      })}
    </section>`;

  container.querySelector("#semester-start-date")?.addEventListener("change", (e) => {
    project.setSemesterStartDate(e.target.value);
    markDirty();
    onUpdate();
  });

  bindTrackingFields(container, project, onUpdate);
  bindApplyButtons(container, project, filters, onUpdate);
}

function bindTrackingFields(container, project, onUpdate) {
  const save = (id, partial) => {
    project.setAssessmentRecord(id, partial);
    markDirty();
  };

  container.querySelectorAll(".assess-status").forEach((el) => {
    el.addEventListener("change", () => save(el.dataset.id, { status: el.value }));
  });

  container.querySelectorAll(".assess-tasks, .assess-notes").forEach((el) => {
    el.addEventListener("blur", () => {
      const partial = el.classList.contains("assess-tasks") ? { tasks: el.value } : { notes: el.value };
      save(el.dataset.id, partial);
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
