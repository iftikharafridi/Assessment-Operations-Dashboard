/**
 * Interactive weekly schedule — Obsidian-parity views:
 * All Weeks | Week by Week | Calendar (time across, days down).
 *
 * Modes:
 * - assessments: one row per assessment event (module + week / W/C / deadline). No group expansion.
 * - classTests: planned class-test delivery sessions only (campus, groups, times).
 */
import { esc, unique } from "../utils/dom.js";
import { WEEKDAYS, campusColor } from "../config/constants.js";
import {
  buildClassTestItems,
  teachingWeekCommencing,
} from "../analytics/class-test-viz.js";
import {
  getCurrentTeachingWeek,
  resolveSemesterStart,
} from "../analytics/assessment.js";
import { timeToMinutes } from "../utils/time.js";
import { formatShortDate, parseFlexibleDate, weekdayName } from "../utils/dates.js";
import { enrichAssessmentEvent } from "../excel/assessment-format.js";

const SLOT_MINUTES = 30;
const MIN_START_HOUR = 8;
const MAX_END_HOUR = 21;
const FULL_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MODULE_COLOR_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#0891b2",
  "#4f46e5",
  "#9333ea",
  "#c026d3",
  "#065f46",
  "#1d4ed8",
];

const CAMPUS_SHORT = {
  "London RAV": "LON-RAV",
  "London IH": "LON-IH",
  "Birmingham LRH": "BIR",
  Manchester: "MAN",
};

function campusShort(campus) {
  return CAMPUS_SHORT[campus] || campus;
}

/** Stable distinct colour per module code (for assessment calendar / chips). */
export function moduleColor(moduleCode) {
  const s = String(moduleCode || "").toUpperCase();
  if (!s) return "#64748b";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return MODULE_COLOR_PALETTE[hash % MODULE_COLOR_PALETTE.length];
}

function formatGroups(item) {
  if (item.letterGroups?.length) return item.letterGroups.join(" & ");
  const letters = [];
  for (const g of item.admissionGroups || []) {
    const dayLetter = String(g).match(/\bDay\s+([A-Z](?:\s*&\s*[A-Z])*)\b/i)?.[1];
    if (dayLetter) {
      for (const L of dayLetter.split(/\s*&\s*/)) {
        if (L && !letters.includes(L.toUpperCase())) letters.push(L.toUpperCase());
      }
      continue;
    }
    const trailing = String(g).match(/\b([A-Z])\s*$/)?.[1];
    if (trailing && !letters.includes(trailing)) letters.push(trailing);
  }
  return letters.length ? letters.join(" & ") : "—";
}

function formatIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function floorToSlot(mins) {
  return Math.floor(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function ceilToSlot(mins) {
  return Math.ceil(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function weekRangeLabel(semesterStart, weekNum) {
  const start = teachingWeekCommencing(semesterStart, weekNum);
  if (!start) return "";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function dayDateForWeek(semesterStart, weekNum, dayName) {
  const start = teachingWeekCommencing(semesterStart, weekNum);
  if (!start) return null;
  const idx = FULL_WEEKDAYS.indexOf(dayName);
  if (idx < 0) return start;
  const d = new Date(start);
  d.setDate(d.getDate() + idx);
  return d;
}

function assessmentWeek(event) {
  if (event.weekNumber != null && Number.isFinite(Number(event.weekNumber))) {
    return Number(event.weekNumber);
  }
  const match = String(event.weekLabel || "").match(/week\s*(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function eventDate(event) {
  return event.exactDueDate || event.weekCommencing || event.dueDate || "";
}

function eventDay(event) {
  const parsed = parseFlexibleDate(event.exactDueDate || event.dueDate);
  return parsed ? weekdayName(parsed) : "";
}

function eventMatchesSession(event, item) {
  if (String(event.moduleCode || "").toUpperCase() !== String(item.moduleCode || "").toUpperCase()) {
    return false;
  }
  const week = assessmentWeek(event);
  return Number.isFinite(week) && week === item.testWeekNum;
}

function isClassTestEvent(event) {
  return (
    event.suggestsClassTest ||
    event.assessmentType === "classTest" ||
    /class test|practical skills|set exercise|lab/i.test(event.assessmentFormat || "")
  );
}

function effectiveSessionWeek(item, semesterStart) {
  if (Number.isFinite(item.testWeekNum)) return item.testWeekNum;
  if (!semesterStart || !item.testDateParsed) return null;
  const start = teachingWeekCommencing(semesterStart, 1);
  if (!start) return null;
  const diff = Math.floor((item.testDateParsed - start) / 86400000);
  return Math.floor(diff / 7) + 1;
}

function assessmentIdentity(row) {
  return row.eventId || row.sessionId || `${row.module}|${row.week}|${row.assessmentCode}`;
}

function countWeekRows(rows) {
  const assessmentIds = new Set(rows.map(assessmentIdentity));
  return {
    assessments: assessmentIds.size,
    sessions: rows.filter((r) => r.rowKind === "session").length,
  };
}

function countLabel(rows, mode = "assessments") {
  if (mode === "classTests") {
    const n = rows.length;
    return `${n} class-test session${n === 1 ? "" : "s"}`;
  }
  const counts = countWeekRows(rows);
  return `${counts.assessments} assessment${counts.assessments === 1 ? "" : "s"}`;
}

function timingLabel(row) {
  if (row.time) return `${row.time}–${row.endTime}`;
  if (row.schedulingBasis === "fixedDeadline" && row.date) return `Deadline ${row.date}`;
  if (row.schedulingBasis === "mixed") {
    const parts = [];
    if (row.date && row.exactDueDate) parts.push(`Deadline ${row.exactDueDate}`);
    else if (row.exactDueDate) parts.push(`Deadline ${row.exactDueDate}`);
    if (row.weekCommencing) parts.push(`W/C ${row.weekCommencing}`);
    else if (row.date && row.schedulingBasis !== "fixedDeadline") parts.push(`W/C ${row.date}`);
    return parts.join(" · ") || "Date not set";
  }
  if (row.weekCommencing || (row.date && row.schedulingBasis === "weekCommencing")) {
    return `W/C ${row.weekCommencing || row.date}`;
  }
  return row.date || "Date not set";
}

function buildAssessmentRows(project) {
  const events = (project.getAssessmentEvents?.() || []).map(enrichAssessmentEvent);
  return events
    .map((event) => {
      const week = assessmentWeek(event);
      const enriched = enrichAssessmentEvent(event);
      const exact = enriched.exactDueDate || "";
      const wc = enriched.weekCommencing || "";
      const day =
        eventDay({ exactDueDate: exact, dueDate: exact }) ||
        (wc ? "Monday" : "");
      const date = exact || wc || eventDate(enriched);
      return {
        rowKind: "assessment",
        mode: "assessments",
        eventId: event.id,
        module: event.moduleCode,
        moduleName: event.moduleName,
        assessmentCode: event.assessmentCode || "Assessment",
        assessmentFormat: enriched.assessmentFormat || "Other Assessment",
        schedulingBasis: enriched.schedulingBasis || "notSpecified",
        weekCommencing: wc,
        exactDueDate: exact,
        campus: "",
        week,
        day,
        date: formatIsoDate(date),
        time: "",
        endTime: "",
        groups: "",
        tutor: "",
        sessionId: "",
        hasConflict: false,
        isAllDay: true,
      };
    })
    .filter((r) => r.module && Number.isFinite(r.week));
}

function buildClassTestRows(project) {
  const events = (project.getAssessmentEvents?.() || []).map(enrichAssessmentEvent);
  const semesterStart = resolveSemesterStart(project, events);
  const items = buildClassTestItems(project, { semesterStart }).map((item) => ({
    ...item,
    testWeekNum: effectiveSessionWeek(item, semesterStart),
  }));

  return items
    .map((item) => {
      const week = item.testWeekNum;
      const matched = events.find((event) => eventMatchesSession(event, item) && isClassTestEvent(event));
      return {
        rowKind: "session",
        mode: "classTests",
        eventId: matched?.id || `plan:${item.sessionId}`,
        module: item.moduleCode,
        moduleName: item.moduleName,
        assessmentCode: matched?.assessmentCode || "Class test",
        assessmentFormat: matched?.assessmentFormat || "Class Test / Lab",
        schedulingBasis: "fixedDeadline",
        weekCommencing: "",
        exactDueDate: formatIsoDate(item.testDate || item.testDateParsed),
        campus: item.campus,
        week,
        day: item.weekday || "",
        date: formatIsoDate(item.testDate || item.testDateParsed),
        time: item.start || "",
        endTime: item.end || "",
        groups: formatGroups(item),
        tutor: item.tutor || "",
        sessionId: item.sessionId,
        hasConflict: item.hasConflict,
        isAllDay: false,
      };
    })
    .filter((r) => r.module && Number.isFinite(r.week));
}

/**
 * @param {object} project
 * @param {{ mode?: 'assessments'|'classTests' }} [options]
 */
export function buildInteractiveScheduleRows(project, { mode = "assessments" } = {}) {
  const rows = mode === "classTests" ? buildClassTestRows(project) : buildAssessmentRows(project);
  return rows.sort(
    (a, b) =>
      a.week - b.week ||
      (FULL_WEEKDAYS.indexOf(a.day) < 0 ? 99 : FULL_WEEKDAYS.indexOf(a.day)) -
        (FULL_WEEKDAYS.indexOf(b.day) < 0 ? 99 : FULL_WEEKDAYS.indexOf(b.day)) ||
      String(a.time || a.date).localeCompare(String(b.time || b.date)) ||
      a.module.localeCompare(b.module) ||
      String(a.campus).localeCompare(String(b.campus))
  );
}

function filterRows(rows, filters = {}, mode = "assessments") {
  const search = String(filters.search || "")
    .toLowerCase()
    .trim();
  return rows.filter((r) => {
    if (filters.module && filters.module !== "all" && r.module !== filters.module) return false;
    if (mode === "classTests") {
      if (filters.campus && filters.campus !== "all" && r.campus !== filters.campus) return false;
      if (filters.group && filters.group !== "all" && r.groups !== filters.group) return false;
      if (filters.tutor && filters.tutor !== "all" && r.tutor !== filters.tutor) return false;
    } else {
      if (filters.format && filters.format !== "all" && r.assessmentFormat !== filters.format) return false;
      if (filters.basis && filters.basis !== "all" && r.schedulingBasis !== filters.basis) return false;
    }
    if (search) {
      const hay = [
        r.module,
        r.moduleName,
        r.assessmentCode,
        r.assessmentFormat,
        r.campus,
        r.groups,
        r.tutor,
        r.day,
        r.time,
        r.endTime,
        r.weekCommencing,
        r.exactDueDate,
        r.date,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function createChip(item, density, mode = "assessments") {
  const colour = mode === "classTests" ? campusColor(item.campus) : moduleColor(item.module);
  const compact = density === "compact";
  const timing = timingLabel(item);
  const tip = esc(
    [
      item.module,
      item.moduleName,
      item.assessmentCode,
      item.assessmentFormat,
      mode === "classTests" ? item.campus : "",
      mode === "classTests" && item.groups ? `Group ${item.groups}` : "",
      timing,
      item.tutor,
    ]
      .filter(Boolean)
      .join(" · ")
  );

  if (mode === "assessments") {
    return `<div class="ias-chip is-assessment" title="${tip}" style="--ias-campus:${colour}" data-compact="${compact ? "1" : "0"}">
      <span class="ias-chip-module">${esc(item.module)}</span>
      <span class="ias-chip-campus">${esc(item.assessmentCode)}</span>
      <span class="ias-chip-format">${esc(item.assessmentFormat)}</span>
      <span class="ias-chip-time">${esc(timing)}</span>
    </div>`;
  }

  return `<div class="ias-chip${item.hasConflict ? " is-conflict" : ""}" title="${tip}" style="--ias-campus:${colour}" data-compact="${compact ? "1" : "0"}">
    <span class="ias-chip-module">${esc(item.module)}</span>
    <span class="ias-chip-campus">${esc(campusShort(item.campus))}</span>
    <span class="ias-chip-format">${esc(item.assessmentFormat)}</span>
    <span class="ias-chip-time">${esc(timing)}</span>
    <span class="ias-chip-group">G${esc(item.groups)}</span>
    <span class="ias-chip-tutor">${esc(item.tutor)}</span>
  </div>`;
}

function renderWeekRow(week, weekItems, { density, semesterStart, currentWeek, viewMode, mode }) {
  const isCurrent = week === currentWeek;
  const range = weekRangeLabel(semesterStart, week);
  let body = "";

  if (!weekItems.length) {
    body = `<div class="ias-empty">${
      viewMode === "single"
        ? mode === "classTests"
          ? "No class tests scheduled for this week"
          : "No assessments scheduled for this week"
        : mode === "classTests"
          ? "No class tests"
          : "No assessments"
    }</div>`;
  } else if (mode === "assessments") {
    body = `<div class="ias-day-chips ias-assessment-week-chips">${weekItems
      .map((i) => createChip(i, density, mode))
      .join("")}</div>`;
  } else {
    const groupNames = [
      ...FULL_WEEKDAYS,
      ...unique(weekItems.map((i) => i.day).filter((d) => d && !FULL_WEEKDAYS.includes(d))),
      "",
    ];
    for (const day of groupNames) {
      const dayItems = weekItems.filter((i) => i.day === day);
      if (!dayItems.length) continue;
      const dayDate = dayDateForWeek(semesterStart, week, day);
      body += `<div class="ias-day-row">
        <div class="ias-day-label">${esc(day ? day.slice(0, 3) : "Week")}
          <span>${dayDate && day ? esc(formatShortDate(dayDate)) : ""}</span>
        </div>
        <div class="ias-day-chips">${dayItems.map((i) => createChip(i, density, mode)).join("")}</div>
      </div>`;
    }
  }

  return `<div class="ias-week-row${isCurrent ? " is-current" : ""}" id="ias-week-${week}" data-week="${week}">
    <div class="ias-week-side">
      <div class="ias-week-title">Week ${week}${isCurrent ? `<span class="ias-now">CURRENT</span>` : ""}</div>
      ${range ? `<div class="ias-week-range">${esc(range)}</div>` : ""}
      <div class="ias-week-count">${esc(countLabel(weekItems, mode))}</div>
    </div>
    <div class="ias-week-main dens-${density}">${body}</div>
  </div>`;
}

function assignLanes(events) {
  const sorted = [...events]
    .map((item) => ({
      ...item,
      startMinutes: timeToMinutes(item.time),
      endMinutes: timeToMinutes(item.endTime),
    }))
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.module.localeCompare(b.module)
    );

  const laneEnds = [];
  for (const event of sorted) {
    let lane = laneEnds.findIndex((end) => event.startMinutes >= end);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(event.endMinutes);
    } else {
      laneEnds[lane] = event.endMinutes;
    }
    event.lane = lane;
  }
  return { events: sorted, laneCount: Math.max(laneEnds.length, 1) };
}

function calendarDayForItem(item) {
  if (item.day && FULL_WEEKDAYS.includes(item.day)) return item.day;
  if (item.schedulingBasis === "weekCommencing" || item.weekCommencing) return "Monday";
  return "";
}

/**
 * Day-track calendar (class-test style): every weekday shown.
 * Assessments → coloured by module; class tests without clock times → by campus.
 */
function renderDayBoardCalendar(week, weekItems, { density, semesterStart, currentWeek, mode }) {
  const isAssessments = mode === "assessments";
  const range = weekRangeLabel(semesterStart, week);
  const placed = weekItems.map((item) => ({ ...item, calDay: calendarDayForItem(item) }));
  const unplaced = placed.filter((i) => !i.calDay);
  const labelWidth = 110;
  const blockH = density === "compact" ? 50 : 62;
  const trackMinH = density === "compact" ? 68 : 84;
  const emptyLabel = isAssessments ? "No assessments" : "No class tests";

  const legendKeys = isAssessments
    ? unique(weekItems.map((i) => i.module)).sort()
    : unique(weekItems.map((i) => i.campus).filter(Boolean)).sort();
  const legend = legendKeys.length
    ? `<div class="ias-cal-legend">${legendKeys
        .map((key) => {
          const colour = isAssessments ? moduleColor(key) : campusColor(key);
          const label = isAssessments ? key : campusShort(key);
          return `<span class="ias-cal-legend-item" style="--ias-campus:${colour}"><i></i>${esc(label)}</span>`;
        })
        .join("")}</div>`
    : "";

  let dayRows = "";
  for (const day of FULL_WEEKDAYS) {
    const dayItems = placed.filter((i) => i.calDay === day);
    const rowHeight = Math.max(trackMinH, dayItems.length * (blockH + 8) + 14);
    const dayDate = dayDateForWeek(semesterStart, week, day);

    let blocks = "";
    dayItems.forEach((item, idx) => {
      const colour = isAssessments ? moduleColor(item.module) : campusColor(item.campus);
      const tip = esc(
        isAssessments
          ? [item.module, item.assessmentCode, item.assessmentFormat, timingLabel(item)].join(" · ")
          : [item.module, item.campus, timingLabel(item), item.groups ? `G${item.groups}` : "", item.tutor]
              .filter(Boolean)
              .join(" · ")
      );
      const top = 7 + idx * (blockH + 8);
      const meta = isAssessments
        ? `<div class="ias-cal-event-meta">${esc(item.assessmentFormat)}</div>
           <div class="ias-cal-event-meta">${esc(timingLabel(item))}</div>`
        : `<div class="ias-cal-event-meta">${esc(timingLabel(item))}${item.groups ? ` · G${esc(item.groups)}` : ""}</div>
           ${item.tutor ? `<div class="ias-cal-event-meta">${esc(item.tutor)}</div>` : ""}`;
      blocks += `<div class="ias-cal-event ias-cal-event-allday" title="${tip}" style="--ias-campus:${colour};top:${top}px;height:${blockH}px">
        <div class="ias-cal-event-top">
          <strong>${esc(item.module)}</strong>
          <span>${esc(isAssessments ? item.assessmentCode : campusShort(item.campus))}</span>
        </div>
        ${meta}
      </div>`;
    });

    if (!dayItems.length) {
      blocks = `<div class="ias-cal-empty">${emptyLabel}</div>`;
    }

    dayRows += `<div class="ias-cal-day" style="--ias-row-h:${rowHeight}px;--ias-label-w:${labelWidth}px">
      <div class="ias-cal-day-label">
        <strong>${esc(day)}</strong>
        <span>${dayDate ? esc(formatShortDate(dayDate)) : ""}</span>
        ${dayItems.length ? `<em>${dayItems.length} item${dayItems.length === 1 ? "" : "s"}</em>` : ""}
      </div>
      <div class="ias-cal-day-track ias-cal-day-track-allday">${blocks}</div>
    </div>`;
  }

  const unplacedHtml = unplaced.length
    ? `<div class="ias-cal-all-day">
        <strong>Week-level (day not set)</strong>
        <div class="ias-day-chips">${unplaced.map((i) => createChip(i, density, mode)).join("")}</div>
      </div>`
    : "";

  return `<div class="ias-cal-header">
      <div><strong>Week ${week} Calendar</strong>${week === currentWeek ? ` <span class="ias-now">CURRENT</span>` : ""}</div>
      <div class="muted small">${esc(range)} · ${esc(countLabel(weekItems, mode))}</div>
    </div>
    ${legend}
    ${unplacedHtml}
    <div class="ias-cal-scroll">
      <div class="ias-cal-inner ias-cal-inner-allday" style="--ias-label-w:${labelWidth}px">
        <div class="ias-cal-top ias-cal-top-allday">
          <div class="ias-cal-corner">Day / Date</div>
          <div class="ias-cal-allday-heading">${isAssessments ? "Assessments" : "Class tests"}</div>
        </div>
        ${dayRows}
      </div>
    </div>
    <p class="muted small ias-hint">${
      isAssessments
        ? "Every weekday is shown. Fixed deadlines sit on their due day; week-commencing items sit on Monday (W/C). Colours are by module."
        : "Every weekday is shown. Colours are by campus."
    }</p>`;
}

function renderTimedCalendar(week, weekItems, { density, semesterStart, currentWeek, mode }) {
  const timedItems = weekItems.filter((i) => i.time && i.endTime);
  const allDayItems = weekItems.filter((i) => !i.time || !i.endTime);
  let calStart = MIN_START_HOUR * 60;
  let calEnd = MAX_END_HOUR * 60;

  const earliest = Math.min(...timedItems.map((i) => timeToMinutes(i.time)));
  const latest = Math.max(...timedItems.map((i) => timeToMinutes(i.endTime)));
  calStart = Math.min(calStart, floorToSlot(earliest));
  calEnd = Math.max(calEnd, ceilToSlot(latest));

  const totalMins = Math.max(calEnd - calStart, SLOT_MINUTES);
  const slotCount = totalMins / SLOT_MINUTES;
  const slotWidth = density === "compact" ? 58 : 72;
  const calendarWidth = slotCount * slotWidth;
  const labelWidth = 105;
  const range = weekRangeLabel(semesterStart, week);

  let timeHeader = "";
  for (let t = calStart; t <= calEnd; t += SLOT_MINUTES) {
    const pct = ((t - calStart) / totalMins) * 100;
    const hour = t % 60 === 0;
    timeHeader += `<div class="ias-cal-gridline${hour ? " is-hour" : ""}" style="left:${pct}%"></div>`;
    if (t < calEnd && hour) {
      timeHeader += `<div class="ias-cal-timelabel" style="left:${pct}%">${minutesToTime(t)}</div>`;
    }
  }

  let dayRows = "";
  for (const day of FULL_WEEKDAYS) {
    const dayItems = timedItems.filter((i) => i.day === day);
    const dayAllDay = allDayItems.filter((i) => calendarDayForItem(i) === day);
    const { events, laneCount } = assignLanes(dayItems);
    const laneHeight = density === "compact" ? 50 : 64;
    const allDayH = dayAllDay.length ? (density === "compact" ? 36 : 44) * Math.ceil(dayAllDay.length / 2) + 8 : 0;
    const rowHeight = Math.max(
      density === "compact" ? 58 : 72,
      laneCount * laneHeight + 10 + allDayH
    );
    const dayDate = dayDateForWeek(semesterStart, week, day);

    let grid = "";
    for (let t = calStart; t <= calEnd; t += SLOT_MINUTES) {
      const pct = ((t - calStart) / totalMins) * 100;
      grid += `<div class="ias-cal-gridline${t % 60 === 0 ? " is-hour" : ""}" style="left:${pct}%"></div>`;
    }

    let blocks = "";
    if (dayAllDay.length) {
      blocks += `<div class="ias-cal-day-allday">${dayAllDay
        .map((i) => createChip(i, density, mode))
        .join("")}</div>`;
    }
    for (const item of events) {
      const start = Math.max(item.startMinutes, calStart);
      const end = Math.min(item.endMinutes, calEnd);
      const left = ((start - calStart) / totalMins) * 100;
      const width = ((end - start) / totalMins) * 100;
      const top = allDayH + 5 + item.lane * laneHeight;
      const height = density === "compact" ? 43 : 56;
      const colour = campusColor(item.campus);
      const tip = esc(
        [item.module, item.campus, `${item.time}–${item.endTime}`, `Group ${item.groups}`, item.tutor].join(
          " · "
        )
      );
      blocks += `<div class="ias-cal-event" title="${tip}" style="--ias-campus:${colour};top:${top}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);height:${height}px">
        <div class="ias-cal-event-top">
          <strong>${esc(item.module)}</strong>
          <span>${esc(campusShort(item.campus))}</span>
        </div>
        <div class="ias-cal-event-meta">${esc(item.time)}–${esc(item.endTime)} · G${esc(item.groups)}</div>
        ${density === "comfortable" ? `<div class="ias-cal-event-tutor">${esc(item.tutor)}</div>` : ""}
      </div>`;
    }

    const totalDayCount = dayItems.length + dayAllDay.length;
    if (!totalDayCount) {
      blocks += `<div class="ias-cal-empty">No class tests</div>`;
    }

    dayRows += `<div class="ias-cal-day" style="--ias-row-h:${rowHeight}px;--ias-cal-w:${calendarWidth}px;--ias-label-w:${labelWidth}px">
      <div class="ias-cal-day-label">
        <strong>${esc(day)}</strong>
        <span>${dayDate ? esc(formatShortDate(dayDate)) : ""}</span>
        ${totalDayCount ? `<em>${totalDayCount} event${totalDayCount === 1 ? "" : "s"}</em>` : ""}
      </div>
      <div class="ias-cal-day-track">${grid}${blocks}</div>
    </div>`;
  }

  const leftover = allDayItems.filter(
    (i) => !calendarDayForItem(i) || !FULL_WEEKDAYS.includes(calendarDayForItem(i))
  );
  const allDayHtml = leftover.length
    ? `<div class="ias-cal-all-day">
        <strong>Week-level</strong>
        <div class="ias-day-chips">${leftover.map((item) => createChip(item, density, mode)).join("")}</div>
      </div>`
    : "";

  return `<div class="ias-cal-header">
      <div><strong>Week ${week} Calendar</strong>${week === currentWeek ? ` <span class="ias-now">CURRENT</span>` : ""}</div>
      <div class="muted small">${esc(range)} · ${esc(countLabel(weekItems, mode))}</div>
    </div>
    ${allDayHtml}
    <div class="ias-cal-scroll">
      <div class="ias-cal-inner" style="--ias-cal-w:${calendarWidth}px;--ias-label-w:${labelWidth}px;min-width:${labelWidth + calendarWidth}px">
        <div class="ias-cal-top">
          <div class="ias-cal-corner">Day / Date</div>
          <div class="ias-cal-times">${timeHeader}</div>
        </div>
        ${dayRows}
      </div>
    </div>
    <p class="muted small ias-hint">Scroll horizontally for the full day. Hover a block for details.</p>`;
}

function renderCalendarView(week, filtered, { density, semesterStart, currentWeek, mode }) {
  const weekItems = filtered.filter((i) => i.week === week);
  if (mode === "assessments") {
    return renderDayBoardCalendar(week, weekItems, { density, semesterStart, currentWeek, mode });
  }
  const timedItems = weekItems.filter((i) => i.time && i.endTime);
  if (!timedItems.length) {
    return renderDayBoardCalendar(week, weekItems, { density, semesterStart, currentWeek, mode });
  }
  return renderTimedCalendar(week, weekItems, { density, semesterStart, currentWeek, mode });
}

function renderDataTable(rows, mode = "assessments") {
  if (!rows.length) return "";
  const isClassTests = mode === "classTests";
  return `<details class="ias-data-table">
    <summary><strong>${isClassTests ? "Class test data table" : "Assessment data table"}</strong> <span class="muted small">${esc(
      countLabel(rows, mode)
    )}</span></summary>
    <div class="table-scroll table-scroll-sticky">
      <table class="data-table table-pro">
        <thead>
          <tr>
            <th>Module</th><th>Assessment</th><th>Format</th>
            ${isClassTests ? "<th>Campus</th>" : ""}
            <th>Week</th><th>Day</th><th>Date / W/C</th>
            ${isClassTests ? "<th>Time</th><th>End Time</th><th>Groups</th><th>Tutor</th>" : "<th>Timing</th>"}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
            <td><strong>${esc(r.module)}</strong></td>
            <td>${esc(r.assessmentCode)}</td>
            <td>${esc(r.assessmentFormat)}</td>
            ${isClassTests ? `<td>${esc(r.campus)}</td>` : ""}
            <td>${esc(r.week)}</td>
            <td>${esc(r.day)}</td>
            <td>${esc(r.exactDueDate || r.weekCommencing || r.date)}</td>
            ${
              isClassTests
                ? `<td>${esc(r.time)}</td><td>${esc(r.endTime)}</td><td>${esc(r.groups)}</td><td>${esc(r.tutor)}</td>`
                : `<td>${esc(timingLabel(r))}</td>`
            }
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </details>`;
}

/**
 * @param {object} project
 * @param {{
 *   mode?: 'assessments'|'classTests',
 *   viewMode?: 'all'|'single'|'calendar',
 *   density?: 'compact'|'comfortable',
 *   selectedWeek?: number|null,
 *   filters?: object,
 * }} opts
 */
export function renderInteractiveAssessmentSchedule(project, opts = {}) {
  const mode = opts.mode === "classTests" ? "classTests" : "assessments";
  const viewMode = opts.viewMode || "all";
  const density = opts.density || "compact";
  const filters = opts.filters || {};
  const allRows = buildInteractiveScheduleRows(project, { mode });
  const events = project.getAssessmentEvents?.() || [];
  const semesterStart = resolveSemesterStart(project, events);
  const current = getCurrentTeachingWeek(semesterStart);
  const currentWeek =
    current && !current.beforeSemester ? current.weekNumber : null;

  const emptyTitle =
    mode === "classTests" ? "No planned class-test sessions yet" : "No assessment events yet";
  const emptyBody =
    mode === "classTests"
      ? "Mark seminar slots as planned class tests below, then they will appear here week by week and in calendar view."
      : "Import an assessment schedule workbook to see modules by teaching week, including class tests and other assessments.";

  if (!allRows.length) {
    return `<section class="panel-section interactive-assessment-schedule" data-ias-mode="${mode}">
      <div class="alert alert-info" role="status">
        <strong>${emptyTitle}</strong>
        <p>${emptyBody}</p>
      </div>
    </section>`;
  }

  const weeksPresent = unique(allRows.map((r) => r.week)).sort((a, b) => a - b);
  const minWeek = Math.min(1, ...weeksPresent);
  const maxWeek = Math.max(14, ...weeksPresent, currentWeek || 1);
  const weekSequence = Array.from(
    { length: maxWeek - minWeek + 1 },
    (_, index) => minWeek + index
  );

  let selectedWeek = opts.selectedWeek;
  if (selectedWeek == null || selectedWeek < minWeek || selectedWeek > maxWeek) {
    if (currentWeek != null && weeksPresent.includes(currentWeek)) selectedWeek = currentWeek;
    else if (weeksPresent.length) {
      selectedWeek = weeksPresent.reduce((nearest, w) =>
        Math.abs(w - (currentWeek || w)) < Math.abs(nearest - (currentWeek || nearest)) ? w : nearest
      );
    } else selectedWeek = 1;
  }

  const filtered = filterRows(allRows, filters, mode);
  const modules = unique(allRows.map((r) => r.module)).sort();
  const formats = unique(allRows.map((r) => r.assessmentFormat).filter(Boolean)).sort();
  const campuses = unique(allRows.map((r) => r.campus).filter(Boolean)).sort();
  const groups = unique(allRows.map((r) => r.groups).filter(Boolean)).sort();
  const tutors = unique(allRows.map((r) => r.tutor).filter(Boolean)).sort();

  const weekPills = weekSequence
    .map((w) => {
      const weekRows = allRows.filter((r) => r.week === w);
      const isCur = w === currentWeek;
      const hasItems = weekRows.length > 0;
      return `<button type="button" class="ias-pill${isCur ? " is-current" : ""}${
        hasItems ? " has-items" : ""
      }" data-ias-jump="${w}">WK${w}</button>`;
    })
    .join("");

  const emptyWeekLabel = mode === "classTests" ? "No class tests" : "No assessments";
  const weekOptions = weekSequence
    .map((w) => {
      const weekRows = allRows.filter((r) => r.week === w);
      const range = weekRangeLabel(semesterStart, w);
      return `<option value="${w}" ${w === selectedWeek ? "selected" : ""}>Week ${w}${
        range ? ` — W/C ${esc(range.split("–")[0].trim())}` : ""
      }${weekRows.length ? ` — ${esc(countLabel(weekRows, mode))}` : ` — ${emptyWeekLabel}`}</option>`;
    })
    .join("");

  let body = "";
  let resultLabel = "";

  if (viewMode === "calendar") {
    const selectedRows = filtered.filter((r) => r.week === selectedWeek);
    resultLabel = `Week ${selectedWeek}: ${countLabel(selectedRows, mode)}`;
    body = renderCalendarView(selectedWeek, filtered, { density, semesterStart, currentWeek, mode });
  } else {
    const weeksToShow = viewMode === "single" ? [selectedWeek] : weekSequence;
    const shownRows = [];
    const parts = [];
    for (const w of weeksToShow) {
      const weekItems = filtered
        .filter((r) => r.week === w)
        .sort(
          (a, b) =>
            (WEEKDAYS.indexOf(a.day) < 0 ? 99 : WEEKDAYS.indexOf(a.day)) -
              (WEEKDAYS.indexOf(b.day) < 0 ? 99 : WEEKDAYS.indexOf(b.day)) ||
            String(a.time || "").localeCompare(String(b.time || "")) ||
            a.module.localeCompare(b.module)
        );
      if (viewMode === "all" && filters.hideEmpty && !weekItems.length) continue;
      shownRows.push(...weekItems);
      parts.push(renderWeekRow(w, weekItems, { density, semesterStart, currentWeek, viewMode, mode }));
    }
    resultLabel =
      viewMode === "single"
        ? `Week ${selectedWeek}: ${countLabel(shownRows, mode)}`
        : countLabel(shownRows, mode);
    body =
      parts.join("") ||
      `<div class="ias-empty-block">${
        mode === "classTests"
          ? "No class tests match the current filters."
          : "No assessments match the current filters."
      }</div>`;
  }

  const subtitle =
    mode === "classTests"
      ? `Weeks ${minWeek}–${maxWeek} · ${allRows.length} session${allRows.length === 1 ? "" : "s"} · ${modules.length} module${modules.length === 1 ? "" : "s"} · ${campuses.length} campus${campuses.length === 1 ? "" : "es"}`
      : `Weeks ${minWeek}–${maxWeek} · ${allRows.length} assessment${allRows.length === 1 ? "" : "s"} · ${modules.length} module${modules.length === 1 ? "" : "s"} (module + week only — no group expansion)`;

  const filterControls =
    mode === "classTests"
      ? `<select id="ias-campus"><option value="all">All campuses</option>${campuses
          .map((c) => `<option value="${esc(c)}" ${filters.campus === c ? "selected" : ""}>${esc(c)}</option>`)
          .join("")}</select>
      <select id="ias-group"><option value="all">All groups</option>${groups
        .map((g) => `<option value="${esc(g)}" ${filters.group === g ? "selected" : ""}>${esc(g)}</option>`)
        .join("")}</select>
      <select id="ias-tutor"><option value="all">All tutors</option>${tutors
        .map((t) => `<option value="${esc(t)}" ${filters.tutor === t ? "selected" : ""}>${esc(t)}</option>`)
        .join("")}</select>`
      : `<select id="ias-format"><option value="all">All formats</option>${formats
          .map(
            (f) =>
              `<option value="${esc(f)}" ${filters.format === f ? "selected" : ""}>${esc(f)}</option>`
          )
          .join("")}</select>
      <select id="ias-basis">
        <option value="all" ${!filters.basis || filters.basis === "all" ? "selected" : ""}>All timing types</option>
        <option value="fixedDeadline" ${filters.basis === "fixedDeadline" ? "selected" : ""}>Fixed deadline</option>
        <option value="weekCommencing" ${filters.basis === "weekCommencing" ? "selected" : ""}>Week commencing</option>
        <option value="mixed" ${filters.basis === "mixed" ? "selected" : ""}>Mixed</option>
        <option value="notSpecified" ${filters.basis === "notSpecified" ? "selected" : ""}>Not specified</option>
      </select>`;

  const legend =
    mode === "classTests"
      ? "Only modules with planned class-test sessions are shown here (with campus, group, and time)."
      : "All assessment modules for the semester, including class tests. Each chip is one assessment component (module + week / deadline) — not expanded by campus or group.";

  return `<section class="panel-section interactive-assessment-schedule" data-ias-mode="${mode}">
    <div class="ias-header">
      <div>
        <div class="ias-title">${mode === "classTests" ? "Class Test Schedule" : "Assessment Schedule"}</div>
        <div class="muted small">${esc(subtitle)}</div>
      </div>
      ${
        currentWeek != null
          ? `<div class="ias-current-badge">Current Week: ${currentWeek}</div>`
          : ""
      }
    </div>

    <div class="ias-controls">
      <input type="search" id="ias-search" placeholder="${
        mode === "classTests" ? "Search module, tutor, campus…" : "Search module, assessment, format…"
      }" value="${esc(filters.search || "")}" />
      <select id="ias-module"><option value="all">All modules</option>${modules
        .map((m) => `<option value="${esc(m)}" ${filters.module === m ? "selected" : ""}>${esc(m)}</option>`)
        .join("")}</select>
      ${filterControls}
      <select id="ias-view">
        <option value="all" ${viewMode === "all" ? "selected" : ""}>All Weeks</option>
        <option value="single" ${viewMode === "single" ? "selected" : ""}>Week by Week</option>
        <option value="calendar" ${viewMode === "calendar" ? "selected" : ""}>Calendar View</option>
      </select>
      <select id="ias-density">
        <option value="compact" ${density === "compact" ? "selected" : ""}>Compact</option>
        <option value="comfortable" ${density === "comfortable" ? "selected" : ""}>Comfortable</option>
      </select>
      <label class="ias-hide-empty${viewMode === "all" ? "" : " is-hidden"}"><input type="checkbox" id="ias-hide-empty" ${
        filters.hideEmpty ? "checked" : ""
      } /> Hide empty weeks</label>
      <button type="button" class="btn btn-small btn-muted" id="ias-clear">Clear</button>
      <span class="ias-result" id="ias-result">${esc(resultLabel)}</span>
    </div>

    <div class="ias-pills${viewMode === "all" ? "" : " is-hidden"}">${weekPills}</div>

    <div class="ias-week-nav${viewMode === "all" ? " is-hidden" : ""}">
      <button type="button" class="btn btn-small" id="ias-prev" ${selectedWeek <= minWeek ? "disabled" : ""}>◀ Previous</button>
      <button type="button" class="btn btn-small" id="ias-now">Current Week</button>
      <button type="button" class="btn btn-small" id="ias-next" ${selectedWeek >= maxWeek ? "disabled" : ""}>Next ▶</button>
      <select id="ias-week-select">${weekOptions}</select>
    </div>

    <div class="ias-body">${body}</div>
    <p class="muted small">${legend}</p>
    ${renderDataTable(filtered, mode)}
  </section>`;
}

export function bindInteractiveAssessmentSchedule(
  container,
  {
    selectedWeek,
    totalWeeksHint,
    mode = "assessments",
    onChange,
  } = {}
) {
  const emit = (partial) => onChange?.(partial);
  const isClassTests = mode === "classTests";

  const readFilters = () => {
    const base = {
      search: container.querySelector("#ias-search")?.value || "",
      module: container.querySelector("#ias-module")?.value || "all",
      hideEmpty: Boolean(container.querySelector("#ias-hide-empty")?.checked),
    };
    if (isClassTests) {
      return {
        ...base,
        campus: container.querySelector("#ias-campus")?.value || "all",
        group: container.querySelector("#ias-group")?.value || "all",
        tutor: container.querySelector("#ias-tutor")?.value || "all",
      };
    }
    return {
      ...base,
      format: container.querySelector("#ias-format")?.value || "all",
      basis: container.querySelector("#ias-basis")?.value || "all",
    };
  };

  let searchTimer;
  container.querySelector("#ias-search")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => emit({ filters: readFilters() }), 150);
  });

  const filterSelectors = isClassTests
    ? ["#ias-module", "#ias-campus", "#ias-group", "#ias-tutor", "#ias-hide-empty"]
    : ["#ias-module", "#ias-format", "#ias-basis", "#ias-hide-empty"];
  filterSelectors.forEach((sel) => {
    container.querySelector(sel)?.addEventListener("change", () => emit({ filters: readFilters() }));
  });

  container.querySelector("#ias-view")?.addEventListener("change", (e) => {
    emit({ viewMode: e.target.value });
  });
  container.querySelector("#ias-density")?.addEventListener("change", (e) => {
    emit({ density: e.target.value });
  });

  container.querySelector("#ias-clear")?.addEventListener("click", () => {
    emit({
      viewMode: "all",
      density: "compact",
      selectedWeek: null,
      filters: isClassTests
        ? { search: "", module: "all", campus: "all", group: "all", tutor: "all", hideEmpty: false }
        : { search: "", module: "all", format: "all", basis: "all", hideEmpty: false },
    });
  });

  container.querySelectorAll("[data-ias-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const week = Number(btn.dataset.iasJump);
      const view = container.querySelector("#ias-view")?.value || "all";
      if (view === "single" || view === "calendar") {
        emit({ selectedWeek: week });
        return;
      }
      container.querySelector(`#ias-week-${week}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  const selectableWeeks = [
    ...container.querySelectorAll("#ias-week-select option"),
  ].map((option) => Number(option.value));
  const minWeek = selectableWeeks.length ? Math.min(...selectableWeeks) : 1;
  const maxWeek = totalWeeksHint || (selectableWeeks.length ? Math.max(...selectableWeeks) : 14);
  const activeWeek =
    Number(container.querySelector("#ias-week-select")?.value) ||
    Number(selectedWeek) ||
    minWeek;

  container.querySelector("#ias-prev")?.addEventListener("click", () => {
    if (activeWeek > minWeek) emit({ selectedWeek: activeWeek - 1 });
  });
  container.querySelector("#ias-next")?.addEventListener("click", () => {
    if (activeWeek < maxWeek) emit({ selectedWeek: activeWeek + 1 });
  });
  container.querySelector("#ias-now")?.addEventListener("click", () => {
    emit({ selectedWeek: null, goCurrent: true });
  });
  container.querySelector("#ias-week-select")?.addEventListener("change", (e) => {
    emit({ selectedWeek: Number(e.target.value) });
  });
}
