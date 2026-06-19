import { esc } from "../utils/dom.js";
import { getAssessmentTypeLabel } from "../analytics/assessment.js";

const TYPE_CLASS = {
  classTest: "assess-class-test",
  presentation: "assess-presentation",
  submission: "assess-submission",
  exam: "assess-exam",
  other: "assess-other",
};

export function renderAssessmentTimeline(weeks) {
  if (!weeks.length) return "";

  let html = `<div class="assessment-timeline-wrap">
    <div class="assessment-timeline-legend">
      <span><i class="dot assess-class-test"></i> Class test / lab</span>
      <span><i class="dot assess-presentation"></i> Presentation</span>
      <span><i class="dot assess-submission"></i> Submission</span>
      <span><i class="dot assess-exam"></i> Exam</span>
    </div>
    <div class="assessment-timeline">`;

  for (const week of weeks) {
    const colClass = week.isCurrent ? "timeline-week is-current" : week.isPast ? "timeline-week is-past" : "timeline-week";
    html += `<div class="${colClass}">
      <div class="timeline-week-head">
        <strong>${esc(week.weekLabel)}</strong>
        ${week.weekCommencing ? `<span class="muted small">${esc(week.weekCommencing)}</span>` : ""}
      </div>
      <div class="timeline-week-body">`;

    if (!week.items.length) {
      html += `<span class="timeline-empty muted">—</span>`;
    } else {
      for (const item of week.items) {
        const cls = TYPE_CLASS[item.assessmentType] || TYPE_CLASS.other;
        html += `<div class="timeline-chip ${cls}" title="${esc(item.rawText)}">
          <span class="chip-code">${esc(item.moduleCode)}</span>
          <span class="chip-label">${esc(item.assessmentCode || getAssessmentTypeLabel(item.assessmentType))}</span>
        </div>`;
      }
    }

    html += `</div></div>`;
  }

  html += `</div></div>`;
  return html;
}

export function renderUpcomingList(items, project) {
  if (!items.length) {
    return `<p class="muted">No upcoming assessments found for the current filter.</p>`;
  }

  return `<ul class="upcoming-list">${items
    .map((item) => {
      const record = project.getAssessmentRecord(item.id);
      const due = item.effectiveDueDate || item.dueDate || item.weekCommencing || item.weekLabel;
      const cls = TYPE_CLASS[item.assessmentType] || TYPE_CLASS.other;
      return `<li class="upcoming-item ${cls}">
        <div class="upcoming-main">
          <strong>${esc(item.moduleCode)}</strong> · ${esc(item.assessmentCode || item.title.slice(0, 40))}
          <span class="timeline-chip ${cls}">${esc(getAssessmentTypeLabel(item.assessmentType))}</span>
        </div>
        <div class="upcoming-meta muted">${esc(item.weekLabel)} · Due ${esc(due)} · ${esc(record.status)}</div>
      </li>`;
    })
    .join("")}</ul>`;
}
