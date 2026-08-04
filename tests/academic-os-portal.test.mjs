/**
 * Tests for Academic Operations OS Semester Portal export.
 * Run: node tests/academic-os-portal.test.mjs
 */
import {
  escapeMdCell,
  formatIsoDate,
  replaceGeneratedSection,
  createMarkedDocument,
  AOS_GENERATED_START,
  AOS_GENERATED_END,
  stampForBackup,
  formatMarkdownTable,
} from "../js/obsidian/md-table.js";
import {
  buildPortalFiles,
  applyGeneratedContent,
  PORTAL_MODE_COMPLETE,
  PORTAL_MODE_DATA_ONLY,
} from "../js/obsidian/portal/export.js";
import {
  PORTAL_PAGE_PATHS,
  PORTAL_DATA_PATHS,
  PORTAL_ASSET_PATHS,
  TEACHING_TIMETABLE_HEADERS,
  MODULES_HEADERS,
  TEACHING_TEAM_HEADERS,
  ASSESSMENT_SCHEDULE_HEADERS,
  CLASS_TEST_SCHEDULE_HEADERS,
  PORTAL_NAV_LINKS,
} from "../js/obsidian/portal/paths.js";
import {
  buildTeachingTimetableRows,
  buildModulesRows,
  buildTeachingTeamRows,
  buildAssessmentSchedulePortalRows,
  buildClassTestSchedulePortalRows,
  buildCohortCalendarRows,
  parseOperationalWeek,
} from "../js/obsidian/portal/data-builders.js";
import { parseAssessmentGrid } from "../js/excel/assessment-parser.js";
import { parseAdmissionGroup } from "../js/utils/cohort.js";
import { Project } from "../js/model/project.js";
import { planKey } from "../js/planner/plans.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function assertEq(a, b, msg) {
  assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function makeProject() {
  const project = new Project("S2 2026 Portal Test");
  project.setSemesterStartDate("2026-06-01");
  project.addDataset("timetable", {
    filename: "tt.xlsx",
    fileType: "timetable",
    sheetName: "Sheet1",
    rows: [
      {
        ID: "1",
        "Module code": "COM745",
        "Module name": "Big Data and Infrastructure",
        Activity: "Seminar A",
        Type: "Seminar",
        Weekday: "Monday",
        "Start time": "11:00",
        "End time": "13:00",
        Campus: "Birmingham",
        Staff: "Ada Lovelace",
        "Student Groups": "UU BIR Y1 CS 0126 Day A",
        Size: 24,
      },
      {
        ID: "2",
        "Module code": "COM745",
        "Module name": "Big Data and Infrastructure",
        Activity: "Lecture",
        Type: "Lecture",
        Weekday: "Tuesday",
        "Start time": "09:00",
        "End time": "11:00",
        Campus: "Birmingham",
        Staff: "Ada Lovelace",
        "Student Groups": "UU BIR Y1 CS 0126 Day A",
        Size: 48,
      },
      {
        ID: "3",
        "Module code": "COM720",
        "Module name": "Data Science",
        Activity: "Seminar B",
        Type: "Seminar",
        Weekday: "Wednesday",
        "Start time": "14:00",
        "End time": "16:00",
        Campus: "Manchester",
        Staff: "Grace Hopper",
        "Student Groups": "UU MAN Y1 CS 0526 Day B",
        Size: 20,
      },
    ],
  });

  const grid = [
    ["Assessment Schedule S2 2026"],
    ["Module Code", "", "COM745", "COM720"],
    ["Module Name", "", "Big Data and Infrastructure", "Data Science"],
    ["Course", "", "MSc Computing", "MSc Data Science"],
    ["CRN", "", "1001", "1002"],
    ["Module Coordinator", "", "Alice Coordinator", "Bob Coordinator"],
    ["QAHE Module Leader", "", "Carol Leader", "Dan Leader"],
    ["Week 7", "20 Jul 2026", "CW1 Practical Skills Assessment (30%)\nDuring Week 7 lab classes", ""],
    [
      "Week 14",
      "07 Sep 2026",
      "CW2 Report (70%)\nDue: 4th September 2026\nFeedback: 2nd October 2026",
      "CW2 Presentation (50%)\nDue: Presentation slides by 21st August 2026\nPresentation will be held throughout Week 12 in different groups",
    ],
    ["Week 16", "21 Sep 2026", "", "CW3 Research Paper (50%)\nDue: 25th September 2026"],
  ];
  const events = parseAssessmentGrid(grid, "S2 modules");
  project.addDataset("assessmentSchedule", {
    filename: "as.xlsx",
    fileType: "assessmentSchedule",
    sheetName: "S2 modules",
    rows: [],
    events,
  });

  const seminar = project.getTimetableRows().find((r) => r.ID === "1");
  project.setPlan(planKey(seminar), {
    planned: true,
    status: "Planning",
    testWeek: "Week 7",
    testDate: "2026-07-21",
    testStartTime: "11:00",
    testEndTime: "12:00",
    room: "Lab 3",
    leadTutor: "Ada Lovelace",
    invigilator: "",
    paperReady: true,
    lodReady: false,
  });

  return project;
}

console.log("1. Markdown escaping / UTF-8 / ISO dates");
{
  assertEq(escapeMdCell("a|b"), "a\\|b", "pipe escape");
  assertEq(escapeMdCell("x\ny"), "x<br>y", "newline");
  assertEq(escapeMdCell("Résumé データ"), "Résumé データ", "utf8");
  assertEq(formatIsoDate("2026-07-23T12:00:00"), "2026-07-23", "iso");
}

console.log("2. Generated marker replacement preserves manual text");
{
  const existing = `# Semester Manager

<!-- AOS:GENERATED:START -->
old
<!-- AOS:GENERATED:END -->

## My manual notes
Keep me.
`;
  const result = replaceGeneratedSection(existing, "new portal body");
  assert(result.ok, "replace ok");
  assert(result.markdown.includes("new portal body"), "new body present");
  assert(result.markdown.includes("## My manual notes"), "manual preserved");
  assert(result.markdown.includes("Keep me."), "manual text preserved");
  assert(!result.markdown.includes("\nold\n"), "old generated removed");
  assert(result.markdown.includes(AOS_GENERATED_START), "start marker");
  assert(result.markdown.includes(AOS_GENERATED_END), "end marker");
}

console.log("3. Create marked document and backup stamp");
{
  const doc = createMarkedDocument("Teaching Timetable", "| A | B |\n| --- | --- |\n| 1 | 2 |");
  assert(doc.startsWith("# Teaching Timetable"), "title");
  assert(doc.includes(AOS_GENERATED_START), "has start");
  assert(/^\d{8}-\d{6}$/.test(stampForBackup(new Date("2026-07-23T15:04:05"))), "stamp");
}

console.log("4. Windows-style path splitting in contracts");
{
  assert(PORTAL_DATA_PATHS.teachingTimetable.includes("_Data/"), "posix relative path");
  assert(!PORTAL_DATA_PATHS.teachingTimetable.includes("\\"), "no backslash in contract");
  const parts = PORTAL_DATA_PATHS.teachingTimetable.split(/[/\\]/).filter(Boolean);
  assertEq(parts[0], "_Data", "data folder");
  assertEq(parts[1], "Teaching Timetable.md", "file name");
}

console.log("5. Assessment weeks beyond Week 12 + metadata");
{
  const project = makeProject();
  const events = project.getAssessmentEvents();
  assert(events.some((e) => e.weekNumber === 14 || e.weekNumber === 16), "events beyond week 12");
  const withMeta = events.find((e) => e.moduleCode === "COM745");
  assertEq(withMeta?.course, "MSc Computing", "course metadata");
  assertEq(withMeta?.crn, "1001", "crn metadata");
  assert(!!withMeta?.moduleCoordinator, "coordinator");
  assert(!!withMeta?.qaheModuleLeader, "qahe leader");

  const { rows } = buildAssessmentSchedulePortalRows(project);
  const late = rows.filter((r) => Number(r[6]) > 12);
  assert(late.length >= 1, "assessment export includes weeks > 12");
  const mixed = rows.find((r) => /mixed/i.test(String(r[11])));
  const fixed = rows.find((r) => /fixed/i.test(String(r[11])));
  const group = rows.find((r) => /group-based/i.test(String(r[11])));
  assert(!!fixed, "fixed deadline row");
  assert(!!group || !!mixed, "group-based or mixed row");
}

console.log("6. Timetable export — no invented room column");
{
  const project = makeProject();
  const { headers, rows } = buildTeachingTimetableRows(project);
  assertEq(headers.join("|"), TEACHING_TIMETABLE_HEADERS.join("|"), "exact headers");
  assert(!headers.includes("Room"), "no room column");
  assertEq(rows.length, 3, "three sessions");
  assertEq(rows[0].length, headers.length, "cell count");
}

console.log("7. Module + teaching team aggregation");
{
  const project = makeProject();
  const mods = buildModulesRows(project);
  assert(mods.rows.some((r) => r[0] === "COM745"), "COM745 module");
  assert(mods.rows.some((r) => r[0] === "COM720"), "COM720 module");
  const com745 = mods.rows.find((r) => r[0] === "COM745");
  assert(Number(com745[10]) === 2, "session count 2");
  assert(Number(com745[11]) >= 1, "assessment count");
  assertEq(com745[2], "MSc Computing", "course on module row");

  const team = buildTeachingTeamRows(project);
  assert(team.rows.every((r) => r[0]), "no placeholder staff");
  assert(team.rows.some((r) => r[0] === "Ada Lovelace" && r[1] === "COM745"), "Ada/COM745");
  assertEq(team.headers.join("|"), TEACHING_TEAM_HEADERS.join("|"), "team headers");
}

console.log("8. Class tests — no placeholders; missing room handled");
{
  const project = makeProject();
  const { rows, warnings } = buildClassTestSchedulePortalRows(project);
  assertEq(rows.length, 1, "only planned tests");
  assertEq(rows[0][12], "Lab 3", "room from plan");
  assert(warnings.some((w) => /invigilator/i.test(w)), "missing invigilator warning");

  const empty = new Project("empty");
  const none = buildClassTestSchedulePortalRows(empty);
  assertEq(none.rows.length, 0, "no placeholder class-test rows");
}

console.log("9. Cohort parsing");
{
  const parsed = parseAdmissionGroup("UU BIR Y1 CS 0126 Day A");
  assert(parsed.parsed, "parsed");
  assertEq(parsed.siteName, "Birmingham", "site");
  assertEq(parsed.programme, "CS", "programme");
  assertEq(parsed.cohortLabel, "Jan 26", "intake label");

  const project = makeProject();
  const cohorts = buildCohortCalendarRows(project);
  assert(cohorts.rows.length >= 2, "cohort rows");
  assert(
    cohorts.rows.every((r) => r[9] === "" || r[10]),
    "blank cohort week or warning when unknown"
  );
}

console.log("10. Complete portal creation (virtual empty folder)");
{
  const project = makeProject();
  const built = buildPortalFiles(project, { mode: PORTAL_MODE_COMPLETE, exportedAt: "2026-07-23 12:00" });
  const paths = built.files.map((f) => f.path);
  assert(!paths.some((p) => /Semester Manager/i.test(p)), "no semester manager page");
  assert(!paths.some((p) => /Operations Centre/i.test(p)), "no operations centre page");
  assert(paths.includes(PORTAL_PAGE_PATHS.teachingCentre), "teaching");
  assert(paths.includes(PORTAL_PAGE_PATHS.assessmentCentre), "assessment");
  assert(paths.includes(PORTAL_DATA_PATHS.teachingTimetable), "timetable data");
  assert(paths.includes(PORTAL_DATA_PATHS.modules), "modules data");
  assert(paths.includes(PORTAL_ASSET_PATHS.css), "css asset");
  assertEq(built.files.filter((f) => f.kind === "page").length, 2, "2 pages");
  assert(built.files.filter((f) => f.kind === "data").length >= 10, "10+ data files");

  const teaching = built.files.find((f) => f.path === PORTAL_PAGE_PATHS.teachingCentre).generated;
  for (const link of PORTAL_NAV_LINKS) {
    assert(teaching.includes(link.path) || teaching.includes(link.label), `nav ${link.label}`);
  }
  assert(!teaching.includes("Semester Manager"), "nav has no semester manager");
  assert(!teaching.includes("Operations"), "nav has no operations");

  for (const label of ["Day/Time Grid", "All Sessions"]) {
    assert(teaching.includes(label), `teaching view ${label}`);
  }
  for (const removed of ["This Week", "Weekly Calendar", "By Campus", "By Module", "By Tutor"]) {
    assert(!teaching.includes(`"label":"${removed}"`) && !teaching.includes(`label: "${removed}"`), `removed teaching view ${removed}`);
  }
  assert(teaching.includes("aos-cal-event-timed") || teaching.includes("aos-teach-block"), "teaching grid spans session duration");
  assert(teaching.includes("aos-cal-timelabel"), "teaching grid has time labels");

  const assessment = built.files.find((f) => f.path === PORTAL_PAGE_PATHS.assessmentCentre).generated;
  for (const label of [
    "All Weeks",
    "Week by Week",
    "Calendar",
    "Class Tests",
    "All Assessments",
  ]) {
    assert(assessment.includes(label), `assessment view ${label}`);
  }
  for (const removed of ["Overview", "Semester Map", "Timeline", "By Module"]) {
    assert(!assessment.includes(`label: "${removed}"`) && !assessment.includes(`"label":"${removed}"`), `removed view ${removed}`);
  }
  assert(!assessment.includes('"id":"thisWeek"') && !assessment.includes("id: \"thisWeek\""), "This Week merged into Week by Week");
  assert(assessment.includes("aos-sched-chip"), "assessment schedule chips");
  assert(assessment.includes("aos-week-pill"), "week pills");
  assert(assessment.includes("aos-mod-line"), "module-per-line grouping");
  assert(assessment.includes("aos-mod-line-name"), "module name on assessment lines");
  assert(assessment.includes("aos-sched-name") || assessment.includes('["Module name"]'), "module name on class-test chips");
  assert(assessment.includes("deadlineLabel"), "merged deadline column");
  assert(assessment.includes("ctViews"), "class test sub-views");
  assert(assessment.includes("campusColor"), "class tests coloured by campus");
  assert(assessment.includes("AOS.mountShell"), "UI mounts inside Dataview");
  assert(assessment.includes("No planned delivery sessions") || assessment.includes("No planned class-test sessions"), "empty class-test guidance");
  const css = built.files.find((f) => f.path === PORTAL_ASSET_PATHS.css).generated;
  assert(assessment.includes("colorByModule"), "assessment calendar colours by module");
  assert(assessment.includes("showEmptyDays: true"), "assessment calendar shows all days");
  assert(assessment.includes("renderTimedWeekCalendar"), "class-test calendar has timed layout");
  assert(assessment.includes("aos-cal-timelabel"), "class-test calendar shows time labels on top");
  assert(css.includes("aos-cal-event"), "portal CSS has calendar event cards");
  assert(css.includes("aos-cal-timed-scroll"), "portal CSS has timed calendar scroll");
  assert(css.includes("aos-mod-line"), "portal CSS has module lines");
  assert(css.includes("aos-mod-line-name"), "portal CSS has module name style");
  assert(css.includes(".theme-dark"), "CSS binds to Obsidian theme classes");
  assert(!css.includes("backdrop-filter"), "no backdrop blur");

  assert(teaching.includes("Missing source file") || teaching.includes("AOS.missing"), "missing source messaging helper");
}

console.log("11. Data-only update excludes pages and CSS");
{
  const project = makeProject();
  const built = buildPortalFiles(project, { mode: PORTAL_MODE_DATA_ONLY });
  assertEq(built.files.filter((f) => f.kind === "page").length, 0, "no pages");
  assertEq(built.files.filter((f) => f.kind === "asset").length, 0, "no css");
  assert(built.files.every((f) => f.kind === "data"), "only data");
  assert(built.rowCounts.timetable === 3, "summary timetable count");
  assert(built.rowCounts.assessments >= 1, "summary assessment count");
}

console.log("12. applyGeneratedContent on existing page");
{
  const existing = createMarkedDocument("Teaching Centre", "OLD");
  const withManual = existing + "\n\n## Staff notes\nDo not delete.\n";
  const applied = applyGeneratedContent(withManual, "Teaching Centre", "NEW BODY");
  assert(applied.markdown.includes("NEW BODY"), "updated");
  assert(applied.markdown.includes("Do not delete."), "manual kept");
  assert(!applied.markdown.includes("OLD"), "old gone");
}

console.log("13. Operational week parsing");
{
  assertEq(parseOperationalWeek("Week -2"), "-2", "neg");
  assertEq(parseOperationalWeek("Week 15"), "15", "15");
}

console.log("14. Header contracts for key tables");
{
  assertEq(ASSESSMENT_SCHEDULE_HEADERS.length, 25, "assessment cols");
  assertEq(CLASS_TEST_SCHEDULE_HEADERS.length, 20, "class test cols");
  assertEq(MODULES_HEADERS[0], "Module code", "modules start");
  const table = formatMarkdownTable(["A", "B"], [["1", "2"]]);
  assert(table.includes("| A | B |"), "format table");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
