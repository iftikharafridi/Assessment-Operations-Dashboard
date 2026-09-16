/**
 * Semester map placement, split-session merge, Teaching Team / Groups.
 * Run: node tests/teaching-team-map.test.mjs
 */
import { Project } from "../js/model/project.js";
import {
  itemInAssessmentTeachingWeek,
  deadlineFallsOutsideMatrixWeek,
  filterAssessmentItemsForWeek,
} from "../js/analytics/assessment-viz.js";
import { mergeSplitSessions } from "../js/utils/session-merge.js";
import { buildTeachingTeamRows, buildGroupsReport } from "../js/analytics/teaching-team.js";
import { renderTeachingTeamView } from "../js/views/teaching-team.js";
import { TABS, TEACHING_TEAM_SUB_VIEWS } from "../js/components/tabs.js";
import { parseIsoDate } from "../js/analytics/assessment.js";

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

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

console.log("1. itemInAssessmentTeachingWeek — matrix week only (no dual column)");
{
  const semesterStart = "2026-06-01";
  // Week 5 w/c ≈ 2026-06-29; Week 7 w/c ≈ 2026-07-13
  const item = {
    weekNumber: 5,
    dueDateParsed: parseIsoDate("2026-07-15"),
  };
  assert(itemInAssessmentTeachingWeek(item, 5, semesterStart), "matches Excel week 5");
  assert(!itemInAssessmentTeachingWeek(item, 7, semesterStart), "does not also match due-date week 7");
  assert(deadlineFallsOutsideMatrixWeek(item, semesterStart), "chip hint when deadline off matrix week");

  const inWeek5 = filterAssessmentItemsForWeek([item], 5, semesterStart);
  const inWeek7 = filterAssessmentItemsForWeek([item], 7, semesterStart);
  assertEq(inWeek5.length, 1, "week 5 filter keeps item");
  assertEq(inWeek7.length, 0, "week 7 filter excludes matrix-week-5 item");
}

console.log("2. itemInAssessmentTeachingWeek — due-date fallback when week missing");
{
  const semesterStart = "2026-06-01";
  const item = {
    weekNumber: null,
    dueDateParsed: parseIsoDate("2026-07-15"),
  };
  assert(!itemInAssessmentTeachingWeek(item, 5, semesterStart), "no matrix week → not week 5");
  assert(itemInAssessmentTeachingWeek(item, 7, semesterStart), "falls back to due-date teaching week 7");
  assert(!deadlineFallsOutsideMatrixWeek(item, semesterStart), "no off-week hint without matrix week");
}

console.log("3. mergeSplitSessions — merges ≤30 min gap");
{
  const base = {
    "Module code": "BMG921",
    Campus: "London RAV",
    Staff: "Tutor X",
    Weekday: "Monday",
    Type: "Lecture",
    Activity: "Lecture all",
    "Student Groups": "UU LND Y1 BA 0126 Day A",
  };
  const a = { ...base, ID: "1", "Start time": "09:30", "End time": "10:30" };
  const b = { ...base, ID: "2", "Start time": "11:00", "End time": "12:00" };
  const merged = mergeSplitSessions([a, b]);
  assertEq(merged.length, 1, "two blocks → one session");
  assertEq(merged[0]["Start time"], "09:30", "start from first");
  assertEq(merged[0]["End time"], "12:00", "end from second");
  assertEq(merged[0].mergedFrom, 2, "mergedFrom = 2");
  assertEq(merged[0].Activity, "Lecture all", "keeps first Activity");
}

console.log("4. mergeSplitSessions — does not merge different tutors / large gaps");
{
  const base = {
    "Module code": "BMG921",
    Campus: "London RAV",
    Weekday: "Monday",
    Type: "Lecture",
    Activity: "Lecture",
  };
  const differentTutor = mergeSplitSessions([
    { ...base, Staff: "A", "Start time": "09:30", "End time": "10:30" },
    { ...base, Staff: "B", "Start time": "11:00", "End time": "12:00" },
  ]);
  assertEq(differentTutor.length, 2, "different tutors stay separate");

  const differentModule = mergeSplitSessions([
    { ...base, Staff: "A", "Module code": "AAA", "Start time": "09:30", "End time": "10:30" },
    { ...base, Staff: "A", "Module code": "BBB", "Start time": "11:00", "End time": "12:00" },
  ]);
  assertEq(differentModule.length, 2, "different modules stay separate");

  const wideGap = mergeSplitSessions([
    { ...base, Staff: "A", "Start time": "09:30", "End time": "10:30" },
    { ...base, Staff: "A", "Start time": "11:30", "End time": "12:30" },
  ]);
  assertEq(wideGap.length, 2, "gap > 30 min not merged");
}

console.log("5. Teaching team hours count merged duration once");
{
  const project = new Project("merge hours");
  project.addDataset("timetable", {
    filename: "t.xlsx",
    fileType: "timetable",
    sheetName: "Timetable",
    rows: [
      {
        ID: "1",
        "Module code": "BMG921",
        "Module name": "Mgmt",
        Activity: "Lecture",
        Type: "Lecture",
        Weekday: "Monday",
        "Start time": "09:30",
        "End time": "10:30",
        Campus: "London RAV",
        Staff: "Tutor X",
        "Student Groups": "UU LND Y1 BA 0126 Day A",
        Size: 40,
      },
      {
        ID: "2",
        "Module code": "BMG921",
        "Module name": "Mgmt",
        Activity: "Lecture",
        Type: "Lecture",
        Weekday: "Monday",
        "Start time": "11:00",
        "End time": "12:00",
        Campus: "London RAV",
        Staff: "Tutor X",
        "Student Groups": "UU LND Y1 BA 0126 Day A",
        Size: 40,
      },
    ],
  });
  const team = buildTeachingTeamRows(project);
  assertEq(team.entries.length, 1, "one tutor–module row");
  assertEq(team.entries[0].sessions, 1, "one merged session");
  assertEq(team.entries[0].hours, 2.5, "09:30–12:00 = 2.5h not 2.0");
}

console.log("6. Groups report — letter, merged GRP A & B, admission");
{
  const project = new Project("groups");
  project.addDataset("timetable", {
    filename: "t.xlsx",
    fileType: "timetable",
    sheetName: "Timetable",
    rows: [
      {
        ID: "1",
        "Module code": "COM745",
        "Module name": "Big Data",
        Activity: "Seminar GRP A",
        Type: "Seminar",
        Weekday: "Monday",
        "Start time": "14:30",
        "End time": "17:30",
        Campus: "Birmingham LRH",
        Staff: "Tutor A",
        "Student Groups": "UU BIR Y1 CS 0126 Day A",
        Size: 20,
      },
      {
        ID: "2",
        "Module code": "COM745",
        "Module name": "Big Data",
        Activity: "Seminar GRP A & B",
        Type: "Seminar",
        Weekday: "Wednesday",
        "Start time": "09:00",
        "End time": "12:00",
        Campus: "Manchester",
        Staff: "Tutor B",
        "Student Groups": "UU MAN Y1 CS 0126 Day A, UU MAN Y1 CS 0126 Day B",
        Size: 40,
      },
    ],
  });
  const report = buildGroupsReport(project);
  assert(report.letterGroups.includes("A") && report.letterGroups.includes("B"), "letter groups A and B");
  assertEq(report.mergedSections.length, 1, "one merged GRP A & B row");
  assert(/GRP A & B/i.test(report.mergedSections[0].activity), "merged activity text");
  assert(report.admissionCohorts.length >= 2, "admission cohort strings listed");
  assertEq(report.summary.mergedSectionCount, 1, "summary merged count");
}

console.log("7. Teaching Team tab smoke");
{
  assert(TABS.some((t) => t.id === "teachingTeam"), "Teaching Team in TABS");
  assert(TEACHING_TEAM_SUB_VIEWS.some((v) => v.id === "groups"), "Groups sub-view");

  const project = new Project("smoke");
  project.addDataset("timetable", {
    filename: "t.xlsx",
    fileType: "timetable",
    sheetName: "Timetable",
    rows: [
      {
        ID: "1",
        "Module code": "COM745",
        "Module name": "Big Data",
        Activity: "Seminar GRP A & B",
        Type: "Seminar",
        Weekday: "Monday",
        "Start time": "14:30",
        "End time": "17:30",
        Campus: "Birmingham LRH",
        Staff: "Tutor A",
        "Student Groups": "UU BIR Y1 CS 0126 Day A",
        Size: 20,
      },
    ],
  });

  const container = { innerHTML: "", querySelectorAll() { return []; } };
  renderTeachingTeamView({
    project,
    container,
    state: { teachingTeamSubView: "byTutor" },
  });
  assert(/Teaching Team/.test(container.innerHTML), "byTutor renders title");
  assert(/Tutor A/.test(container.innerHTML), "byTutor shows staff");

  renderTeachingTeamView({
    project,
    container,
    state: { teachingTeamSubView: "groups" },
  });
  assert(/Merged sections/.test(container.innerHTML), "Groups sub-view renders");
  assert(/GRP A &amp; B|GRP A & B/.test(container.innerHTML), "Groups lists combined GRP A & B");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
