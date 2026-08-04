import { Project } from "../js/model/project.js";
import { planKey } from "../js/planner/plans.js";
import {
  buildInteractiveScheduleRows,
  renderInteractiveAssessmentSchedule,
} from "../js/components/interactive-assessment-schedule.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function makeProject() {
  const project = new Project("All assessments");
  project.setSemesterStartDate("2026-06-01");
  project.addDataset("timetable", {
    filename: "timetable.xlsx",
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
        Activity: "Seminar GRP B",
        Type: "Seminar",
        Weekday: "Wednesday",
        "Start time": "14:30",
        "End time": "17:30",
        Campus: "Manchester",
        Staff: "Tutor B",
        "Student Groups": "UU MAN Y1 CS 0126 Day B",
        Size: 20,
      },
    ],
  });

  project.addDataset("assessmentSchedule", {
    filename: "assessment.xlsx",
    fileType: "assessmentSchedule",
    sheetName: "S2 modules",
    rows: [],
    events: [
      {
        id: "ct",
        moduleCode: "COM745",
        moduleName: "Big Data",
        weekNumber: 7,
        weekLabel: "Week 7",
        weekCommencing: "2026-07-13",
        assessmentCode: "CW1",
        assessmentType: "classTest",
        assessmentFormat: "Practical Skills Assessment",
        schedulingBasis: "weekCommencing",
        suggestsClassTest: true,
        title: "CW1 Practical Skills Assessment",
        rawText: "CW1 Practical Skills Assessment during Week 7 labs",
      },
      {
        id: "report",
        moduleCode: "COM745",
        moduleName: "Big Data",
        weekNumber: 7,
        weekLabel: "Week 7",
        assessmentCode: "CW2",
        assessmentType: "submission",
        assessmentFormat: "Report",
        schedulingBasis: "fixedDeadline",
        exactDueDate: "2026-07-17",
        dueDate: "2026-07-17",
        title: "CW2 Report",
        rawText: "CW2 Report due 17 July 2026",
      },
      {
        id: "project",
        moduleCode: "COM720",
        moduleName: "Data Science",
        weekNumber: 14,
        weekLabel: "Week 14",
        assessmentCode: "CW1",
        assessmentType: "submission",
        assessmentFormat: "Project",
        schedulingBasis: "fixedDeadline",
        exactDueDate: "2026-09-04",
        dueDate: "2026-09-04",
        title: "CW1 Project",
        rawText: "CW1 Project due 4 September 2026",
      },
    ],
  });

  for (const row of project.getTimetableRows()) {
    project.setPlan(planKey(row), {
      planned: true,
      status: "Planning",
      testWeek: "Week 7",
      testDate: row.ID === "1" ? "2026-07-13" : "2026-07-15",
      testStartTime: "14:30",
      testEndTime: "17:30",
      leadTutor: row.Staff,
    });
  }
  return project;
}

console.log("Assessments mode (module + week, no group expansion)");
{
  const project = makeProject();
  const rows = buildInteractiveScheduleRows(project, { mode: "assessments" });
  assert(rows.length === 3, "one row per assessment event");
  assert(rows.every((r) => r.rowKind === "assessment"), "assessments mode has no session expansion");
  assert(rows.filter((r) => r.eventId === "ct").length === 1, "class test is a single assessment row");
  assert(rows.some((r) => r.eventId === "report" && r.assessmentFormat === "Report"), "report included");
  assert(rows.some((r) => r.eventId === "project" && r.week === 14), "later assessment included");

  const html = renderInteractiveAssessmentSchedule(project, {
    mode: "assessments",
    viewMode: "all",
    density: "compact",
  });
  assert(html.includes("3 assessments"), "header counts assessments only");
  assert(html.includes("no group expansion"), "subtitle explains no group expansion");
  assert(html.includes(">WK7</button>"), "week pill shows plain week label");
  assert(!html.includes("WK7 · "), "week pill has no count");
  assert(html.includes(">WK14</button>"), "week 14 pill appears");
  assert(html.includes("Report"), "non-class-test format is rendered");
  assert(!html.includes("delivery sessions"), "assessments mode does not mention delivery sessions");

  const cal = renderInteractiveAssessmentSchedule(project, {
    mode: "assessments",
    viewMode: "calendar",
    density: "compact",
    selectedWeek: 7,
  });
  assert(cal.includes("ias-cal-day-track-allday") || cal.includes("ias-cal-event-allday"), "assessment calendar uses day-track layout");
  assert(cal.includes("Monday") && cal.includes("Sunday"), "assessment calendar shows all weekdays");
  assert(cal.includes("COM745"), "module appears on calendar");
  assert(cal.includes("ias-cal-legend") || cal.includes("--ias-campus"), "module colour legend or coloured blocks");
}

console.log("Class Tests mode (planned sessions only)");
{
  const project = makeProject();
  const rows = buildInteractiveScheduleRows(project, { mode: "classTests" });
  assert(rows.length === 2, "two planned class-test sessions");
  assert(rows.every((r) => r.rowKind === "session"), "classTests mode is session rows only");
  assert(rows.every((r) => r.module === "COM745"), "only class-test module sessions");
  assert(!rows.some((r) => r.eventId === "report"), "report is not a class-test session");
  assert(!rows.some((r) => r.eventId === "project"), "project is not a class-test session");

  const html = renderInteractiveAssessmentSchedule(project, {
    mode: "classTests",
    viewMode: "all",
    density: "compact",
  });
  assert(html.includes("Class Test Schedule"), "class tests title");
  assert(html.includes("2 sessions"), "header counts sessions");
  assert(html.includes("Birmingham") || html.includes("BIR"), "campus shown for sessions");
  assert(html.includes(">WK7</button>"), "week pill shows plain week label");

  const cal = renderInteractiveAssessmentSchedule(project, {
    mode: "classTests",
    viewMode: "calendar",
    density: "compact",
    selectedWeek: 7,
  });
  assert(cal.includes("ias-cal-scroll") || cal.includes("14:30"), "timed calendar for class tests");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
