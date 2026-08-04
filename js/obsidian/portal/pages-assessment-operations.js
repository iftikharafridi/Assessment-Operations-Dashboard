import { renderPortalNavHtml, renderPortalNavBottomHtml, portalSharedDvJs } from "./shared-dv.js";

function wrapPage(activeId, title, bodyHtml, dvScript) {
  return [
    renderPortalNavHtml(activeId),
    `<div class="aos-header"><h1>${title}</h1></div>`,
    bodyHtml,
    "```dataviewjs",
    portalSharedDvJs(),
    dvScript,
    "```",
    renderPortalNavBottomHtml(activeId),
  ].join("\n\n");
}

export function buildAssessmentCentrePage() {
  const views = [
    { id: "allWeeks", label: "All Weeks" },
    { id: "weekByWeek", label: "Week by Week" },
    { id: "calendar", label: "Calendar" },
    { id: "classTests", label: "Class Tests" },
    { id: "all", label: "All Assessments" },
  ];

  const ctViews = [
    { id: "allWeeks", label: "All Weeks" },
    { id: "weekByWeek", label: "Week by Week" },
    { id: "calendar", label: "Calendar" },
    { id: "table", label: "Table" },
  ];

  const body = `
<p class="aos-muted">Semester assessment schedule — All Weeks, Week by Week (includes current week), Calendar, Class Tests, and a simple All Assessments list.</p>
<p class="aos-muted"><strong>Reading view + Dataview required.</strong> Use the toolbar below (inside the Dataview block).</p>
`.trim();

  const script = `
await AOS.loadCss();
AOS.mountShell(\`<div id="aos-toolbar"></div><div class="aos-filters" id="aos-filters"></div><div id="aos-view"></div>\`);
const views = ${JSON.stringify(views)};
const ctViews = ${JSON.stringify(ctViews)};
let active = "allWeeks";
let ctView = "allWeeks";
let filterModule = "";
let filterFormat = "";
let filterBasis = "";
let filterCampus = "";
let search = "";
let weekCursor = 0;
let hideEmpty = false;
const WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MODULE_COLORS = ["#2563eb","#7c3aed","#db2777","#dc2626","#ea580c","#ca8a04","#16a34a","#0d9488","#0891b2","#4f46e5","#9333ea","#c026d3","#065f46","#1d4ed8"];
const CAMPUS_COLORS = {"London RAV":"#2563eb","London IH":"#7c3aed","Birmingham LRH":"#059669"};

function moduleColor(code) {
  const s = String(code || "").toUpperCase();
  if (!s) return "#64748b";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return MODULE_COLORS[hash % MODULE_COLORS.length];
}

function campusColor(campus) {
  return CAMPUS_COLORS[campus] || "#64748b";
}

const asmt = await AOS.loadTable("_Data/Assessment Schedule.md");
const cts = await AOS.loadTable("_Data/Class Test Schedule.md");
const settings = await AOS.loadTable("_Data/Semester Settings.md");
const settingsMap = Object.fromEntries((settings.rows||[]).map(r => [r.Setting, r.Value]));
const semesterStartIso = settingsMap["Semester start (Week 1 W/C)"] || "";
const exportedWeekLabel = settingsMap["Current operational week"] || "";

/** Live teaching week from semester start + today (exported label is only a fallback). */
function computeCurrentWeek(startIso) {
  if (!startIso) return { weekNumber: null, label: exportedWeekLabel || "—", beforeSemester: false };
  const start = new Date(String(startIso).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(start.getTime())) return { weekNumber: null, label: exportedWeekLabel || "—", beforeSemester: false };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.floor((today - startDay) / 86400000);
  if (diffDays < 0) {
    return { weekNumber: null, label: "Before semester", beforeSemester: true, daysUntilStart: -diffDays };
  }
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return { weekNumber, label: "Week " + weekNumber, beforeSemester: false };
}

const currentWeekInfo = computeCurrentWeek(semesterStartIso);
const currentWeekNum = Number.isFinite(currentWeekInfo.weekNumber) ? currentWeekInfo.weekNumber : null;
const currentWeekLabel = currentWeekInfo.label;

function list() {
  if (!asmt.ok) return [];
  return asmt.rows.filter(r => {
    if (filterModule && r["Module code"] !== filterModule) return false;
    if (filterFormat && r["Assessment format"] !== filterFormat) return false;
    if (filterBasis && r["Scheduling basis"] !== filterBasis) return false;
    if (search) {
      const hay = [r["Module code"], r["Module name"], r.Assessment, r["Assessment format"], r["W/C"], r["Fixed deadline"]].join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

function ctList() {
  if (!cts.ok) return [];
  return cts.rows.filter(r => {
    if (filterModule && r["Module code"] !== filterModule) return false;
    if (filterCampus && r.Campus !== filterCampus) return false;
    if (search) {
      const hay = [r["Module code"], r["Module name"], r.Campus, r.Group, r.Date, r["Start time"]].join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

function weekNums(rows) {
  const nums = rows.map(r => Number(r["Operational week"])).filter(n => Number.isFinite(n));
  // Start at Week 1 unless the data includes earlier (pre-semester) weeks.
  const min = nums.length ? Math.min(1, ...nums) : 1;
  const max = Math.max(14, ...(nums.length ? nums : [14]), currentWeekNum || 1);
  const out = [];
  for (let w = min; w <= max; w++) out.push(w);
  return out;
}

function selectedWeek(rows) {
  const weeks = weekNums(rows);
  if (!weeks.length) return 1;
  const base = currentWeekNum != null ? currentWeekNum : weeks.find((w) => w >= 1) || weeks[0];
  const target = base + weekCursor;
  if (weeks.includes(target)) return target;
  if (target < weeks[0]) return weeks[0];
  if (target > weeks[weeks.length - 1]) return weeks[weeks.length - 1];
  return weeks.reduce((best, w) => Math.abs(w - target) < Math.abs(best - target) ? w : best, weeks[0]);
}

function weekdayFromIso(value) {
  if (!value) return "";
  const d = new Date(String(value).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1] || "";
}

/** Single deadline label: fixed date, or W/C date when not fixed. */
function deadlineLabel(r) {
  const basis = r["Scheduling basis"] || "";
  const fixed = r["Fixed deadline"];
  const wc = r["W/C"];
  if (/mixed/i.test(basis)) {
    const parts = [];
    if (fixed) parts.push(fixed);
    if (wc) parts.push("W/C " + wc);
    return parts.join(" · ") || "—";
  }
  if (fixed && /fixed/i.test(basis)) return fixed;
  if (wc && /group|week commencing/i.test(basis)) return "W/C " + wc;
  if (fixed) return fixed;
  if (wc) return "W/C " + wc;
  return "—";
}

function asmtTiming(r) {
  const d = deadlineLabel(r);
  return d === "—" ? "Date not set" : d;
}

function asmtDay(r) {
  const basis = r["Scheduling basis"] || "";
  if (r["Fixed deadline"] && (/fixed/i.test(basis) || !r["W/C"])) return weekdayFromIso(r["Fixed deadline"]);
  if (r["W/C"] || /group|week commencing/i.test(basis)) return "Monday";
  return weekdayFromIso(r["Fixed deadline"]) || "";
}

function asmtChip(r) {
  const colour = moduleColor(r["Module code"]);
  const tip = [r["Module code"], r["Module name"], r.Assessment, r["Assessment format"], asmtTiming(r)].filter(Boolean).join(" · ");
  return \`<div class="aos-sched-chip" title="\${AOS.esc(tip)}" style="--aos-chip:\${colour}">
    <span class="aos-sched-code">\${AOS.esc(r.Assessment)}</span>
    <span class="aos-sched-fmt">\${AOS.esc(r["Assessment format"])}</span>
    <span class="aos-sched-time">\${AOS.esc(asmtTiming(r))}</span>
  </div>\`;
}

function ctDay(r) {
  return weekdayFromIso(r.Date) || "";
}

function ctChip(r) {
  const colour = campusColor(r.Campus);
  const tip = [r["Module code"], r["Module name"], r.Campus, (r["Start time"]||"") + "–" + (r["End time"]||""), r.Group ? ("Group " + r.Group) : ""].filter(Boolean).join(" · ");
  return \`<div class="aos-sched-chip aos-sched-ct" title="\${AOS.esc(tip)}" style="--aos-chip:\${colour}">
    <span class="aos-sched-mod">\${AOS.esc(r["Module code"])}</span>
    <span class="aos-sched-name">\${AOS.esc(r["Module name"] || "")}</span>
    <span class="aos-sched-group">G\${AOS.esc(r.Group||"—")}</span>
    <span class="aos-sched-fmt">\${AOS.esc(r["Start time"]||"—")}–\${AOS.esc(r["End time"]||"—")}</span>
    <span class="aos-sched-time">\${AOS.esc(r.Room||"")}</span>
  </div>\`;
}

function weekPills(rows, sourceRows) {
  const weeks = weekNums(sourceRows);
  const status = currentWeekInfo.beforeSemester
    ? \`<div class="aos-muted">Current position: <strong>Before semester</strong> (starts \${AOS.esc(semesterStartIso || "—")})</div>\`
    : \`<div class="aos-muted">Current teaching week: <strong>\${AOS.esc(currentWeekLabel)}</strong> · Semester start \${AOS.esc(semesterStartIso || "—")}</div>\`;
  return status + \`<div class="aos-week-pills">\${weeks.map(w => {
    const has = rows.some(r => Number(r["Operational week"]) === w) || sourceRows.some(r => Number(r["Operational week"]) === w);
    const isCur = currentWeekNum != null && w === currentWeekNum;
    return \`<button type="button" class="aos-week-pill\${isCur?" is-current":""}\${has?" has-items":""}" data-jump-week="\${w}">WK\${w}</button>\`;
  }).join("")}</div>\`;
}

function weekNav(w, weeks) {
  const min = weeks[0];
  const max = weeks[weeks.length - 1];
  return \`<div class="aos-week-nav">
    <button type="button" id="w-prev" \${w <= min ? "disabled" : ""}>◀ Previous</button>
    <button type="button" id="w-now" \${currentWeekNum == null ? "disabled" : ""}>Current Week</button>
    <button type="button" id="w-next" \${w >= max ? "disabled" : ""}>Next ▶</button>
    <select id="w-select">\${weeks.map(x => \`<option value="\${x}" \${x===w?"selected":""}>Week \${x}\${currentWeekNum != null && x===currentWeekNum?" (current)":""}</option>\`).join("")}</select>
  </div>\`;
}

function renderGroupedLines(items, chipFn, groupKeyFn, colourFn, labelFn) {
  const keys = AOS.unique(items.map(groupKeyFn).filter(Boolean));
  if (!keys.length) return \`<div class="aos-sched-chips">\${items.map(chipFn).join("")}</div>\`;
  return keys.map(key => {
    const group = items.filter(r => groupKeyFn(r) === key);
    const colour = colourFn(key, group[0]);
    const label = labelFn
      ? labelFn(key, group[0])
      : AOS.esc(key);
    return \`<div class="aos-mod-line" style="--aos-chip:\${colour}">
      <div class="aos-mod-line-label">\${label}</div>
      <div class="aos-sched-chips">\${group.map(chipFn).join("")}</div>
    </div>\`;
  }).join("");
}

function weekRow(w, items, chipFn, emptyLabel, groupOpts) {
  const isCur = currentWeekNum != null && w === currentWeekNum;
  let main = \`<div class="aos-empty">\${emptyLabel}</div>\`;
  if (items.length) {
    main = groupOpts
      ? renderGroupedLines(items, chipFn, groupOpts.keyFn, groupOpts.colourFn, groupOpts.labelFn)
      : \`<div class="aos-sched-chips">\${items.map(chipFn).join("")}</div>\`;
  }
  return \`<div class="aos-week-row\${isCur?" is-current":""}" id="aos-week-\${w}">
    <div class="aos-week-side">
      <div class="aos-week-title">Week \${w}\${isCur?' <span class="aos-chip aos-chip-today">CURRENT</span>':""}</div>
      <div class="aos-week-count">\${items.length} item\${items.length===1?"":"s"}</div>
    </div>
    <div class="aos-week-main">\${main}</div>
  </div>\`;
}

const asmtGroup = {
  keyFn: r => r["Module code"] || "—",
  colourFn: (key) => moduleColor(key),
  labelFn: (key, sample) => \`<strong>\${AOS.esc(key)}</strong>\${sample && sample["Module name"] ? \`<span class="aos-mod-line-name">\${AOS.esc(sample["Module name"])}</span>\` : ""}\`,
};
const ctGroup = {
  keyFn: r => r.Campus || "—",
  colourFn: (key) => campusColor(key),
};

function renderAllWeeks(rows, chipFn, emptyLabel, sourceRows, groupOpts) {
  const weeks = weekNums(sourceRows.length ? sourceRows : rows);
  const parts = [];
  for (const w of weeks) {
    const items = rows.filter(r => Number(r["Operational week"]) === w);
    if (hideEmpty && !items.length) continue;
    parts.push(weekRow(w, items, chipFn, emptyLabel, groupOpts));
  }
  return weekPills(rows, sourceRows.length ? sourceRows : rows)
    + (parts.join("") || \`<div class="aos-empty">\${emptyLabel}</div>\`);
}

function renderWeekByWeekSchedule(rows, chipFn, emptyLabel, sourceRows, groupOpts) {
  const weeks = weekNums(sourceRows.length ? sourceRows : rows);
  const w = selectedWeek(sourceRows.length ? sourceRows : rows);
  const items = rows.filter(r => Number(r["Operational week"]) === w);
  return weekNav(w, weeks) + weekRow(w, items, chipFn, emptyLabel, groupOpts);
}

function timeToMinutes(time) {
  if (!time) return 0;
  const parts = String(time).trim().match(/^(\\d{1,2}):(\\d{2})/);
  if (!parts) return 0;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function floorToSlot(mins) { return Math.floor(mins / 30) * 30; }
function ceilToSlot(mins) { return Math.ceil(mins / 30) * 30; }

function campusShort(campus) {
  return ({ "London RAV": "LON-RAV", "London IH": "LON-IH", "Birmingham LRH": "BIR" })[campus] || campus || "";
}

function assignLanes(events) {
  const sorted = events.map(r => ({
    r,
    startMinutes: timeToMinutes(r["Start time"]),
    endMinutes: timeToMinutes(r["End time"]),
  })).sort((a, b) =>
    a.startMinutes - b.startMinutes ||
    a.endMinutes - b.endMinutes ||
    String(a.r["Module code"] || "").localeCompare(String(b.r["Module code"] || ""))
  );
  const laneEnds = [];
  for (const event of sorted) {
    let lane = laneEnds.findIndex(end => event.startMinutes >= end);
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

/** Timed calendar: hours across the top, days down (class tests with start/end times). */
function renderTimedWeekCalendar(rows, chipFn, dayFn, emptyLabel, sourceRows) {
  const weeks = weekNums(sourceRows.length ? sourceRows : rows);
  const w = selectedWeek(sourceRows.length ? sourceRows : rows);
  const items = rows.filter(r => Number(r["Operational week"]) === w);
  const timed = items.filter(r => r["Start time"] && r["End time"]);
  const allDay = items.filter(r => !r["Start time"] || !r["End time"]);
  if (!timed.length) return null;

  const SLOT = 30;
  let calStart = 8 * 60;
  let calEnd = 21 * 60;
  const earliest = Math.min(...timed.map(r => timeToMinutes(r["Start time"])));
  const latest = Math.max(...timed.map(r => timeToMinutes(r["End time"])));
  calStart = Math.min(calStart, floorToSlot(earliest));
  calEnd = Math.max(calEnd, ceilToSlot(latest));
  const totalMins = Math.max(calEnd - calStart, SLOT);
  const slotWidth = 64;
  const calendarWidth = (totalMins / SLOT) * slotWidth;
  const labelWidth = 105;

  let timeHeader = "";
  for (let t = calStart; t <= calEnd; t += SLOT) {
    const pct = ((t - calStart) / totalMins) * 100;
    const hour = t % 60 === 0;
    timeHeader += \`<div class="aos-cal-gridline\${hour ? " is-hour" : ""}" style="left:\${pct}%"></div>\`;
    if (t < calEnd && hour) {
      timeHeader += \`<div class="aos-cal-timelabel" style="left:\${pct}%">\${minutesToTime(t)}</div>\`;
    }
  }

  const legendKeys = AOS.unique(items.map(r => r.Campus).filter(Boolean));
  const legend = legendKeys.length
    ? \`<div class="aos-cal-legend">\${legendKeys.map(m =>
        \`<span class="aos-cal-legend-item" style="--aos-chip:\${campusColor(m)}"><i></i>\${AOS.esc(m)}</span>\`
      ).join("")}</div>\`
    : "";

  const dayRows = WEEKDAYS.map(day => {
    const dayTimed = timed.filter(r => dayFn(r) === day);
    const dayAllDay = allDay.filter(r => dayFn(r) === day);
    const { events, laneCount } = assignLanes(dayTimed);
    const laneHeight = 58;
    const allDayH = dayAllDay.length ? 40 * Math.ceil(dayAllDay.length / 2) + 8 : 0;
    const rowHeight = Math.max(72, laneCount * laneHeight + 10 + allDayH);

    let grid = "";
    for (let t = calStart; t <= calEnd; t += SLOT) {
      const pct = ((t - calStart) / totalMins) * 100;
      grid += \`<div class="aos-cal-gridline\${t % 60 === 0 ? " is-hour" : ""}" style="left:\${pct}%"></div>\`;
    }

    let blocks = "";
    if (dayAllDay.length) {
      blocks += \`<div class="aos-cal-day-allday">\${dayAllDay.map(chipFn).join("")}</div>\`;
    }
    for (const event of events) {
      const r = event.r;
      const start = Math.max(event.startMinutes, calStart);
      const end = Math.min(event.endMinutes, calEnd);
      const left = ((start - calStart) / totalMins) * 100;
      const width = ((end - start) / totalMins) * 100;
      const top = allDayH + 5 + event.lane * laneHeight;
      const colour = campusColor(r.Campus);
      const tip = [r["Module code"], r["Module name"], r.Campus, (r["Start time"]||"") + "–" + (r["End time"]||""), r.Group ? ("G" + r.Group) : ""].filter(Boolean).join(" · ");
      blocks += \`<div class="aos-cal-event aos-cal-event-timed" title="\${AOS.esc(tip)}" style="--aos-chip:\${colour};top:\${top}px;left:calc(\${left}% + 2px);width:calc(\${width}% - 4px);height:52px">
        <div class="aos-cal-event-top"><strong>\${AOS.esc(r["Module code"] || "")}</strong>
          <span>\${AOS.esc(campusShort(r.Campus))}</span>
          \${r.Group ? \`<span class="aos-sched-group">G\${AOS.esc(r.Group)}</span>\` : ""}</div>
        <div class="aos-cal-event-meta">\${AOS.esc(r["Module name"] || "")}</div>
        <div class="aos-cal-event-meta">\${AOS.esc(r["Start time"])}–\${AOS.esc(r["End time"])}\${r.Room ? " · " + AOS.esc(r.Room) : ""}</div>
      </div>\`;
    }
    if (!dayTimed.length && !dayAllDay.length) {
      blocks += \`<div class="aos-empty">\${emptyLabel}</div>\`;
    }

    return \`<div class="aos-cal-timed-day" style="--aos-row-h:\${rowHeight}px;--aos-cal-w:\${calendarWidth}px;--aos-label-w:\${labelWidth}px">
      <div class="aos-cal-day-label"><strong>\${day}</strong>
        <em>\${dayTimed.length + dayAllDay.length ? (dayTimed.length + dayAllDay.length) + " event" + ((dayTimed.length + dayAllDay.length) === 1 ? "" : "s") : ""}</em>
      </div>
      <div class="aos-cal-timed-track">\${grid}\${blocks}</div>
    </div>\`;
  }).join("");

  const leftover = allDay.filter(r => !dayFn(r) || !WEEKDAYS.includes(dayFn(r)));
  const leftoverHtml = leftover.length
    ? \`<div class="aos-cal-all-day"><strong>Week-level (day not set)</strong><div class="aos-sched-chips">\${leftover.map(chipFn).join("")}</div></div>\`
    : "";

  return weekNav(w, weeks)
    + \`<div class="aos-cal-header"><strong>Week \${w} Calendar</strong>\${currentWeekNum != null && w===currentWeekNum?' <span class="aos-chip aos-chip-today">CURRENT</span>':""}
      <span class="aos-muted"> · \${items.length} item\${items.length===1?"":"s"}</span></div>\`
    + legend
    + leftoverHtml
    + \`<div class="aos-cal-timed-scroll">
      <div class="aos-cal-timed-inner" style="--aos-cal-w:\${calendarWidth}px;--aos-label-w:\${labelWidth}px;min-width:\${labelWidth + calendarWidth}px">
        <div class="aos-cal-timed-top">
          <div class="aos-cal-corner">Day</div>
          <div class="aos-cal-times">\${timeHeader}</div>
        </div>
        \${dayRows}
      </div>
    </div>\`
    + \`<p class="aos-muted aos-hint">Time runs across the top. Scroll horizontally for the full day. Colours are by campus.</p>\`;
}

function renderWeekCalendar(rows, chipFn, dayFn, emptyLabel, sourceRows, { showEmptyDays = true, colorByModule = false, colorByCampus = false } = {}) {
  if (colorByCampus) {
    const timed = renderTimedWeekCalendar(rows, chipFn, dayFn, emptyLabel, sourceRows);
    if (timed) return timed;
  }

  const weeks = weekNums(sourceRows.length ? sourceRows : rows);
  const w = selectedWeek(sourceRows.length ? sourceRows : rows);
  const items = rows.filter(r => Number(r["Operational week"]) === w);
  const placed = items.map(r => ({ r, day: dayFn(r) }));
  const unplaced = placed.filter(x => !x.day);

  const legendKeys = colorByModule
    ? AOS.unique(items.map(r => r["Module code"]))
    : colorByCampus
      ? AOS.unique(items.map(r => r.Campus).filter(Boolean))
      : [];
  const legend = legendKeys.length
    ? \`<div class="aos-cal-legend">\${legendKeys.map(m =>
        \`<span class="aos-cal-legend-item" style="--aos-chip:\${colorByCampus ? campusColor(m) : moduleColor(m)}"><i></i>\${AOS.esc(m)}</span>\`
      ).join("")}</div>\`
    : "";

  const dayRows = WEEKDAYS.map(day => {
    const dayItems = placed.filter(x => x.day === day).map(x => x.r);
    if (!dayItems.length && !showEmptyDays) return "";
    const cards = dayItems.length
      ? dayItems.map(r => {
          const colour = colorByCampus
            ? campusColor(r.Campus)
            : colorByModule
              ? moduleColor(r["Module code"])
              : "var(--aos-accent)";
          return \`<div class="aos-cal-event" style="--aos-chip:\${colour}">
            <div class="aos-cal-event-top"><strong>\${AOS.esc(r["Module code"] || "")}</strong>
              <span>\${AOS.esc(r.Assessment || r.Campus || "")}</span>
              \${r.Group ? \`<span class="aos-sched-group">G\${AOS.esc(r.Group)}</span>\` : ""}</div>
            <div class="aos-cal-event-meta">\${AOS.esc(r["Module name"] || "")}</div>
            <div class="aos-cal-event-meta">\${AOS.esc(
              r["Start time"]
                ? ((r.Campus || "") + " · " + (r["Start time"]||"") + "–" + (r["End time"]||"") + (r.Room ? (" · " + r.Room) : ""))
                : ((r["Assessment format"] || "") + " · " + asmtTiming(r))
            )}</div>
          </div>\`;
        }).join("")
      : \`<div class="aos-empty">\${emptyLabel}</div>\`;
    return \`<div class="aos-cal-day-row aos-cal-day-track-row">
      <div class="aos-cal-day-label"><strong>\${day}</strong></div>
      <div class="aos-cal-day-track">\${cards}</div>
    </div>\`;
  }).join("") || \`<div class="aos-empty">\${emptyLabel}</div>\`;

  const unplacedHtml = unplaced.length
    ? \`<div class="aos-cal-all-day"><strong>Week-level (day not set)</strong><div class="aos-sched-chips">\${unplaced.map(x => chipFn(x.r)).join("")}</div></div>\`
    : "";
  const hint = colorByCampus
    ? "Colours are by campus. Group and time are on each session."
    : "Every weekday is shown. Fixed deadlines sit on their due day; week-commencing items sit on Monday (W/C). Colours are by module.";
  return weekNav(w, weeks)
    + \`<div class="aos-cal-header"><strong>Week \${w} Calendar</strong>\${currentWeekNum != null && w===currentWeekNum?' <span class="aos-chip aos-chip-today">CURRENT</span>':""}
      <span class="aos-muted"> · \${items.length} item\${items.length===1?"":"s"}</span></div>\`
    + legend
    + unplacedHtml
    + \`<div class="aos-cal-day-grid aos-cal-board">\${dayRows}</div>\`
    + \`<p class="aos-muted aos-hint">\${hint}</p>\`;
}

function renderFilters() {
  const all = asmt.ok ? asmt.rows : [];
  const ctAll = cts.ok ? cts.rows : [];
  const filtersEl = AOS.el("aos-filters");
  if (active === "classTests") {
    filtersEl.innerHTML = \`
      <select id="f-mod"><option value="">All modules</option>\${AOS.unique(ctAll.map(r=>r["Module code"])).map(c=>\`<option \${c===filterModule?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
      <select id="f-campus"><option value="">All campuses</option>\${AOS.unique(ctAll.map(r=>r.Campus).filter(Boolean)).map(c=>\`<option \${c===filterCampus?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
      <input id="f-search" placeholder="Search module, campus, group…" value="\${AOS.esc(search)}" />
      <label class="aos-hide-empty"><input type="checkbox" id="f-hide-empty" \${hideEmpty?"checked":""}/> Hide empty weeks</label>
    \`;
    filtersEl.querySelector("#f-mod").onchange = e => { filterModule = e.target.value; render(); };
    filtersEl.querySelector("#f-campus").onchange = e => { filterCampus = e.target.value; render(); };
    filtersEl.querySelector("#f-search").oninput = e => { search = e.target.value; render(); };
    filtersEl.querySelector("#f-hide-empty").onchange = e => { hideEmpty = e.target.checked; render(); };
    return;
  }
  filtersEl.innerHTML = \`
    <select id="f-mod"><option value="">All modules</option>\${AOS.unique(all.map(r=>r["Module code"])).map(c=>\`<option \${c===filterModule?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <select id="f-fmt"><option value="">All formats</option>\${AOS.unique(all.map(r=>r["Assessment format"])).map(c=>\`<option \${c===filterFormat?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <select id="f-basis"><option value="">All scheduling</option>\${AOS.unique(all.map(r=>r["Scheduling basis"])).map(c=>\`<option \${c===filterBasis?"selected":""}>\${AOS.esc(c)}</option>\`).join("")}</select>
    <input id="f-search" placeholder="Search…" value="\${AOS.esc(search)}" />
    <label class="aos-hide-empty\${active==="allWeeks"?"":" is-hidden"}"><input type="checkbox" id="f-hide-empty" \${hideEmpty?"checked":""}/> Hide empty weeks</label>
  \`;
  filtersEl.querySelector("#f-mod").onchange = e => { filterModule = e.target.value; render(); };
  filtersEl.querySelector("#f-fmt").onchange = e => { filterFormat = e.target.value; render(); };
  filtersEl.querySelector("#f-basis").onchange = e => { filterBasis = e.target.value; render(); };
  filtersEl.querySelector("#f-search").oninput = e => { search = e.target.value; render(); };
  filtersEl.querySelector("#f-hide-empty")?.addEventListener("change", e => { hideEmpty = e.target.checked; render(); });
}

function sortAssessments(rows) {
  return rows.slice().sort((a, b) =>
    (Number(a["Operational week"]) || 999) - (Number(b["Operational week"]) || 999) ||
    String(a["Module code"] || "").localeCompare(String(b["Module code"] || "")) ||
    String(a.Assessment || "").localeCompare(String(b.Assessment || ""))
  );
}

function table(rows) {
  const sorted = sortAssessments(rows);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Week</th><th>Module</th><th>Assessment</th><th>Format</th><th>Weight</th><th>Deadline</th>
  </tr></thead><tbody>
  \${sorted.map(r => {
    const colour = moduleColor(r["Module code"]);
    return \`<tr>
    <td>\${AOS.esc(r["Operational week"])}</td>
    <td><span class="aos-mod-badge" style="--aos-chip:\${colour}">\${AOS.esc(r["Module code"])}</span>
      <br><span class="aos-muted">\${AOS.esc(r["Module name"])}</span></td>
    <td>\${AOS.esc(r.Assessment)}</td>
    <td>\${AOS.esc(r["Assessment format"])}</td>
    <td>\${AOS.esc(r.Weight)}</td>
    <td>\${AOS.esc(deadlineLabel(r))}</td>
  </tr>\`;
  }).join("") || '<tr><td colspan="6">No rows</td></tr>'}
  </tbody></table></div>\`;
}

function ctTable(rows) {
  const sorted = rows.slice().sort((a, b) =>
    (Number(a["Operational week"]) || 999) - (Number(b["Operational week"]) || 999) ||
    String(a.Campus || "").localeCompare(String(b.Campus || "")) ||
    String(a["Module code"] || "").localeCompare(String(b["Module code"] || "")) ||
    String(a.Group || "").localeCompare(String(b.Group || ""))
  );
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Week</th><th>Module</th><th>Campus</th><th>Group</th><th>Date</th><th>Time</th><th>Room</th><th>Status</th>
  </tr></thead><tbody>
  \${sorted.map(r => {
    const colour = campusColor(r.Campus);
    return \`<tr>
    <td>\${AOS.esc(r["Operational week"])}</td>
    <td><span class="aos-mod-badge" style="--aos-chip:\${moduleColor(r["Module code"])}">\${AOS.esc(r["Module code"])}</span></td>
    <td><span class="aos-campus-badge" style="--aos-chip:\${colour}">\${AOS.esc(r.Campus)}</span></td>
    <td>G\${AOS.esc(r.Group||"—")}</td>
    <td>\${AOS.esc(r.Date)}</td>
    <td>\${AOS.esc(r["Start time"])}–\${AOS.esc(r["End time"])}</td>
    <td>\${AOS.esc(r.Room||"—")}</td>
    <td>\${AOS.esc(r.Status)}</td>
  </tr>\`;
  }).join("") || '<tr><td colspan="8">No class tests</td></tr>'}
  </tbody></table></div>\`;
}

function isClassTestAssessment(r) {
  return /class test|practical skills|set exercise|\blab\b/i.test(r["Assessment format"] || "");
}

function candidateClassTestRows() {
  if (!asmt.ok) return [];
  return asmt.rows.filter(isClassTestAssessment);
}

function candidateChip(r) {
  const colour = moduleColor(r["Module code"]);
  const tip = [r["Module code"], r["Module name"], r.Assessment, r["Assessment format"], asmtTiming(r)].filter(Boolean).join(" · ");
  return \`<div class="aos-sched-chip" title="\${AOS.esc(tip)}" style="--aos-chip:\${colour}">
    <span class="aos-sched-code">\${AOS.esc(r.Assessment)}</span>
    <span class="aos-sched-fmt">\${AOS.esc(r["Assessment format"])}</span>
    <span class="aos-sched-time">\${AOS.esc(asmtTiming(r))}</span>
  </div>\`;
}

function renderClassTestCandidates() {
  const rows = candidateClassTestRows();
  if (!rows.length) {
    return \`<div class="aos-callout aos-callout-warn">
      <strong>No planned class-test sessions were exported.</strong>
      <p>In the Operations Dashboard, open the <strong>Class Tests</strong> tab, mark seminar slots as class tests (date/time/room), then use <strong>Create/Update Complete Semester Portal</strong> again.</p>
    </div>\`;
  }
  return \`<div class="aos-callout aos-callout-warn">
      <strong>No planned delivery sessions yet</strong> — showing class-test <em>assessments</em> from the matrix (module + week only).
      <p>To see campus, group, and time here, mark those seminars as planned class tests in the dashboard and re-export.</p>
    </div>\`
    + renderAllWeeks(rows, candidateChip, "No class-test assessments", rows, asmtGroup);
}

function renderClassTests() {
  if (!cts.ok) return AOS.missing(cts.error);
  const rows = ctList();
  const source = cts.rows;
  const sub = \`<div class="aos-toolbar aos-subtoolbar">\${ctViews.map(v =>
    \`<button type="button" data-ct-view="\${v.id}" class="\${ctView===v.id?"aos-active":""}">\${v.label}</button>\`
  ).join("")}</div>\`;

  if (!source.length) {
    return sub + renderClassTestCandidates();
  }

  const intro = \`<p class="aos-muted">Planned class-test sessions (\${source.length}) — coloured by campus, with group and time. Tutor omitted to keep the view clear.</p>\`;
  let body = "";
  if (ctView === "allWeeks") body = renderAllWeeks(rows, ctChip, "No class tests", source, ctGroup);
  else if (ctView === "weekByWeek") body = renderWeekByWeekSchedule(rows, ctChip, "No class tests this week", source, ctGroup);
  else if (ctView === "calendar") body = renderWeekCalendar(rows, ctChip, ctDay, "No class tests", source, { showEmptyDays: true, colorByCampus: true });
  else body = ctTable(rows);
  return sub + intro + body;
}

function bindWeekControls(host, sourceRows) {
  const weeks = weekNums(sourceRows);
  const base = currentWeekNum != null ? currentWeekNum : (weeks.find((x) => x >= 1) || weeks[0] || 1);
  host.querySelector("#w-prev")?.addEventListener("click", () => {
    const w = selectedWeek(sourceRows);
    if (w > weeks[0]) weekCursor = w - 1 - base;
    render();
  });
  host.querySelector("#w-next")?.addEventListener("click", () => {
    const w = selectedWeek(sourceRows);
    if (w < weeks[weeks.length - 1]) weekCursor = w + 1 - base;
    render();
  });
  host.querySelector("#w-now")?.addEventListener("click", () => { weekCursor = 0; render(); });
  host.querySelector("#w-select")?.addEventListener("change", e => {
    const w = Number(e.target.value);
    weekCursor = w - base;
    render();
  });
  host.querySelectorAll("[data-jump-week]").forEach(btn => {
    btn.addEventListener("click", () => {
      const w = Number(btn.dataset.jumpWeek);
      if (active === "weekByWeek" || active === "calendar" || (active === "classTests" && (ctView === "weekByWeek" || ctView === "calendar"))) {
        weekCursor = w - base;
        render();
        return;
      }
      document.getElementById("aos-week-" + w)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  host.querySelectorAll("[data-ct-view]").forEach(btn => {
    btn.addEventListener("click", () => { ctView = btn.dataset.ctView; render(); });
  });
}

function render() {
  const toolbarEl = AOS.el("aos-toolbar");
  toolbarEl.innerHTML = AOS.toolbar(views, active);
  toolbarEl.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => { active = btn.dataset.view; weekCursor = 0; render(); };
  });
  renderFilters();
  const host = AOS.el("aos-view");
  if (!asmt.ok && active !== "classTests") { host.innerHTML = AOS.missing(asmt.error); return; }
  const rows = list();
  const asmtSource = asmt.ok ? asmt.rows : [];
  let html = "";
  if (active === "allWeeks") {
    html = \`<p class="aos-muted">One line per module in each week. Colours are by module; use the module filter to focus.</p>\`
      + renderAllWeeks(rows, asmtChip, "No assessments", asmtSource, asmtGroup);
  } else if (active === "weekByWeek") {
    html = \`<p class="aos-muted">Browse one week at a time — use <strong>Current Week</strong> for this teaching week.</p>\`
      + renderWeekByWeekSchedule(rows, asmtChip, "No assessments this week", asmtSource, asmtGroup);
  } else if (active === "calendar") {
    html = renderWeekCalendar(rows, asmtChip, asmtDay, "No assessments", asmtSource, { showEmptyDays: true, colorByModule: true });
  } else if (active === "classTests") {
    html = renderClassTests();
  } else {
    html = \`<p class="aos-muted">Sorted by week, then module. Deadline shows the fixed date or W/C when not fixed.</p>\` + table(rows);
  }
  host.innerHTML = html;
  bindWeekControls(host, active === "classTests" ? (cts.ok ? cts.rows : []) : asmtSource);
}
render();
`;

  return wrapPage("assessments", "Assessment Centre", body, script);
}

export function buildOperationsCentrePage() {
  const views = [
    { id: "issues", label: "Issues" },
    { id: "readiness", label: "Class-Test Readiness" },
    { id: "invigilation", label: "Invigilation" },
    { id: "team", label: "Teaching Team" },
    { id: "modules", label: "Modules" },
    { id: "cohorts", label: "Cohorts" },
    { id: "quality", label: "Data Quality" },
    { id: "export", label: "Export Details" },
  ];

  const body = `
<p class="aos-muted">Operational checks, readiness gaps, and generated module/cohort directories.</p>
<p class="aos-muted"><strong>Reading view + Dataview required.</strong></p>
`.trim();

  const script = `
await AOS.loadCss();
AOS.mountShell(\`<div id="aos-toolbar"></div><div id="aos-view"></div>\`);
const views = ${JSON.stringify(views)};
let active = "issues";

const issues = await AOS.loadTable("_Data/Issues and Actions.md");
const cts = await AOS.loadTable("_Data/Class Test Schedule.md");
const inv = await AOS.loadTable("_Data/Invigilation Schedule.md");
const team = await AOS.loadTable("_Data/Teaching Team.md");
const modules = await AOS.loadTable("_Data/Modules.md");
const cohorts = await AOS.loadTable("_Data/Cohort Calendar.md");
const summary = await AOS.loadTable("_Data/Export Summary.md");
const asmt = await AOS.loadTable("_Data/Assessment Schedule.md");
const tt = await AOS.loadTable("_Data/Teaching Timetable.md");

function renderIssues() {
  if (!issues.ok) return AOS.missing(issues.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Type</th><th>Severity</th><th>Campus</th><th>Module</th><th>Title</th><th>Action</th><th>Status</th>
  </tr></thead><tbody>
  \${issues.rows.map(r => \`<tr>
    <td>\${AOS.esc(r["Issue type"])}</td><td>\${AOS.esc(r.Severity)}</td><td>\${AOS.esc(r.Campus)}</td>
    <td>\${AOS.esc(r.Module)}</td><td>\${AOS.esc(r.Title)}</td><td>\${AOS.esc(r["Recommended action"])}</td><td>\${AOS.esc(r.Status)}</td>
  </tr>\`).join("") || '<tr><td colspan="7">No issues</td></tr>'}
  </tbody></table></div>\`;
}

function renderReadiness() {
  if (!cts.ok) return AOS.missing(cts.error);
  const rows = cts.rows;
  const planned = rows.length;
  const withDate = rows.filter(r => r.Date).length;
  const withRoom = rows.filter(r => r.Room).length;
  const withTutor = rows.filter(r => r.Tutor).length;
  const withInv = rows.filter(r => r.Invigilator).length;
  const gaps = rows.filter(r => !r.Room || !r.Invigilator || !r.Date);
  return \`<div class="aos-kpis">
    <div class="aos-kpi"><strong>\${planned}</strong><span>Planned</span></div>
    <div class="aos-kpi"><strong>\${withDate}</strong><span>Dates assigned</span></div>
    <div class="aos-kpi"><strong>\${withRoom}</strong><span>Rooms assigned</span></div>
    <div class="aos-kpi"><strong>\${withTutor}</strong><span>Lead tutors</span></div>
    <div class="aos-kpi"><strong>\${withInv}</strong><span>Invigilators</span></div>
    <div class="aos-kpi"><strong>\${gaps.length}</strong><span>Outstanding gaps</span></div>
  </div>
  <h3>Gaps</h3>
  <ul>\${gaps.map(r => \`<li>\${AOS.esc(r["Module code"])} (\${AOS.esc(r.Campus)}) —
    \${!r.Date?"date ":""}\${!r.Room?"room ":""}\${!r.Invigilator?"invigilator":""}</li>\`).join("") || '<li class="aos-ok">No gaps</li>'}</ul>\`;
}

function renderInvigilation() {
  if (!inv.ok) return AOS.missing(inv.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Module</th><th>Campus</th><th>Date</th><th>Time</th><th>Room</th><th>Lead</th><th>Invigilator</th><th>Warning</th><th>Status</th>
  </tr></thead><tbody>
  \${inv.rows.map(r => \`<tr>
    <td>\${AOS.esc(r["Module code"])}</td><td>\${AOS.esc(r.Campus)}</td><td>\${AOS.esc(r.Date)}</td>
    <td>\${AOS.esc(r["Start time"])}–\${AOS.esc(r["End time"])}</td>
    <td>\${AOS.esc(r.Room||"—")}</td><td>\${AOS.esc(r["Lead tutor"])}</td>
    <td>\${AOS.esc(r.Invigilator||"—")}</td><td class="aos-warn">\${AOS.esc(r.Warning)}</td><td>\${AOS.esc(r.Status)}</td>
  </tr>\`).join("")}
  </tbody></table></div>\`;
}

function renderTeam() {
  if (!team.ok) return AOS.missing(team.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Staff</th><th>Module</th><th>Campus</th><th>Sessions</th><th>Lectures</th><th>Seminars</th><th>Weekly hours</th>
  </tr></thead><tbody>
  \${team.rows.map(r => \`<tr>
    <td>\${AOS.esc(r.Staff)}</td><td>\${AOS.esc(r["Module code"])}</td><td>\${AOS.esc(r.Campus)}</td>
    <td>\${AOS.esc(r["Session count"])}</td><td>\${AOS.esc(r["Lecture count"])}</td>
    <td>\${AOS.esc(r["Seminar count"])}</td><td>\${AOS.esc(r["Weekly hours"])}</td>
  </tr>\`).join("")}
  </tbody></table></div>\`;
}

function renderModules() {
  if (!modules.ok) return AOS.missing(modules.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Code</th><th>Name</th><th>Course</th><th>CRN</th><th>Coordinator</th><th>QAHE leader</th><th>Campuses</th><th>Sessions</th><th>Assessments</th>
  </tr></thead><tbody>
  \${modules.rows.map(r => \`<tr>
    <td>\${AOS.esc(r["Module code"])}</td><td>\${AOS.esc(r["Module name"])}</td>
    <td>\${AOS.esc(r["Course/programme"])}</td><td>\${AOS.esc(r.CRN)}</td>
    <td>\${AOS.esc(r["Module coordinator"])}</td><td>\${AOS.esc(r["QAHE module leader"])}</td>
    <td>\${AOS.esc(r.Campuses)}</td><td>\${AOS.esc(r["Session count"])}</td><td>\${AOS.esc(r["Assessment count"])}</td>
  </tr>\`).join("")}
  </tbody></table></div>\`;
}

function renderCohorts() {
  if (!cohorts.ok) return AOS.missing(cohorts.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr>
    <th>Cohort</th><th>Raw group</th><th>Site</th><th>Programme</th><th>Letter</th><th>Sessions</th><th>Modules</th><th>Week</th><th>Warning</th>
  </tr></thead><tbody>
  \${cohorts.rows.map(r => \`<tr>
    <td>\${AOS.esc(r["Cohort label"])}</td><td>\${AOS.esc(r["Raw group"])}</td><td>\${AOS.esc(r["Campus / site"])}</td>
    <td>\${AOS.esc(r.Programme)}</td><td>\${AOS.esc(r["Group letter"])}</td>
    <td>\${AOS.esc(r.Sessions)}</td><td>\${AOS.esc(r.Modules)}</td>
    <td>\${AOS.esc(r["Current cohort week"]||"—")}</td><td class="aos-warn">\${AOS.esc(r.Warning)}</td>
  </tr>\`).join("")}
  </tbody></table></div>\`;
}

function renderQuality() {
  const notes = [];
  if (!tt.ok) notes.push(tt.error);
  if (!asmt.ok) notes.push(asmt.error);
  const missingStaff = (tt.ok?tt.rows:[]).filter(r => !String(r.Staff||"").trim());
  const missingBasis = (asmt.ok?asmt.rows:[]).filter(r => !r["Scheduling basis"] || /not specified/i.test(r["Scheduling basis"]));
  const missingDate = (asmt.ok?asmt.rows:[]).filter(r => !r["W/C"] && !r["Fixed deadline"]);
  const missingRoom = (cts.ok?cts.rows:[]).filter(r => !r.Room);
  const missingInv = (cts.ok?cts.rows:[]).filter(r => !r.Invigilator);
  const malformed = (cohorts.ok?cohorts.rows:[]).filter(r => r.Warning);
  return \`<ul>
    <li>Missing timetable staff rows: <strong>\${missingStaff.length}</strong></li>
    <li>Missing scheduling basis: <strong>\${missingBasis.length}</strong></li>
    <li>Missing assessment date: <strong>\${missingDate.length}</strong></li>
    <li>Missing class-test room: <strong>\${missingRoom.length}</strong></li>
    <li>Missing invigilator: <strong>\${missingInv.length}</strong></li>
    <li>Cohort / group warnings: <strong>\${malformed.length}</strong></li>
    \${notes.map(n => \`<li class="aos-warn">\${AOS.esc(n)}</li>\`).join("")}
  </ul>\`;
}

function renderExport() {
  if (!summary.ok) return AOS.missing(summary.error);
  return \`<div class="aos-table-wrap"><table class="aos-table"><thead><tr><th>Item</th><th>Count</th><th>Notes</th></tr></thead><tbody>
  \${summary.rows.map(r => \`<tr><td>\${AOS.esc(r.Item)}</td><td>\${AOS.esc(r.Count)}</td><td>\${AOS.esc(r.Notes)}</td></tr>\`).join("")}
  </tbody></table></div>\`;
}

function render() {
  const toolbarEl = AOS.el("aos-toolbar");
  toolbarEl.innerHTML = AOS.toolbar(views, active);
  toolbarEl.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => { active = btn.dataset.view; render(); };
  });
  const host = AOS.el("aos-view");
  if (active === "issues") host.innerHTML = renderIssues();
  else if (active === "readiness") host.innerHTML = renderReadiness();
  else if (active === "invigilation") host.innerHTML = renderInvigilation();
  else if (active === "team") host.innerHTML = renderTeam();
  else if (active === "modules") host.innerHTML = renderModules();
  else if (active === "cohorts") host.innerHTML = renderCohorts();
  else if (active === "quality") host.innerHTML = renderQuality();
  else host.innerHTML = renderExport();
}
render();
`;

  return wrapPage("operations", "Operations Centre", body, script);
}
