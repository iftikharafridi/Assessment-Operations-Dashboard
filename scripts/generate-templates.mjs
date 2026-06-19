/**
 * Generate starter Excel templates for GitHub / new users.
 * Run: node scripts/generate-templates.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "../vendor/xlsx/xlsx.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatesDir = path.join(root, "templates");
const sampleDir = path.join(root, "sample");

fs.mkdirSync(templatesDir, { recursive: true });
fs.mkdirSync(sampleDir, { recursive: true });

const timetableRows = [
  {
    ID: 1,
    "Module code": "COM769",
    "Module name": "Example Module A",
    Activity: "COM769 LEC GRP A",
    Type: "Lecture",
    Weekday: "Wednesday",
    "Start time": "09:30",
    "End time": "11:30",
    Room: "",
    Campus: "London RAV",
    Staff: "Tutor Name",
    "Student Groups": "Grp A",
    Size: 10,
  },
  {
    ID: 2,
    "Module code": "COM769",
    "Module name": "Example Module A",
    Activity: "COM769 SEM GRP A",
    Type: "Seminar",
    Weekday: "Friday",
    "Start time": "09:30",
    "End time": "11:30",
    Room: "",
    Campus: "London RAV",
    Staff: "Tutor Name",
    "Student Groups": "Grp A",
    Size: 10,
  },
  {
    ID: 3,
    "Module code": "COM745",
    "Module name": "Example Module B",
    Activity: "COM745 SEM GRP A",
    Type: "Seminar",
    Weekday: "Monday",
    "Start time": "14:30",
    "End time": "16:30",
    Room: "",
    Campus: "Birmingham LRH",
    Staff: "Another Tutor",
    "Student Groups": "Grp A",
    Size: 8,
  },
];

const timetableInstructions = [
  {
    Step: 1,
    Instruction: "Keep the header row on the Timetable sheet exactly as shown.",
  },
  {
    Step: 2,
    Instruction: "Replace the example rows with your real sessions (one row per session).",
  },
  {
    Step: 3,
    Instruction: "Required columns: Module code, Campus, Weekday, Staff, Start time.",
  },
  {
    Step: 4,
    Instruction: "Use Type = Seminar for slots you may use as class tests.",
  },
  {
    Step: 5,
    Instruction: "Save the file, then upload it on the dashboard welcome page.",
  },
];

const assessmentRows = [
  {
    "Module code": "COM769",
    "Module name": "Example Module A",
    Semester: "Three",
    Week: "Week 7",
    "Week commencing": "2026-07-13",
    Assessment: "CW1",
    Type: "classTest",
    Weight: "25%",
    Due: "During Week 7 lab classes",
    "Due date": "2026-07-13",
    Feedback: "w/c 10 August 2026",
    "Class test candidate": "Yes",
    Details: "CW1 (25%) - Practical Skills Assessment\nDue: During Week 7 labs",
  },
  {
    "Module code": "COM769",
    "Module name": "Example Module A",
    Semester: "Three",
    Week: "Week 11",
    "Week commencing": "2026-08-10",
    Assessment: "CW2",
    Type: "submission",
    Weight: "75%",
    Due: "Friday 14 August 2026",
    "Due date": "2026-08-14",
    Feedback: "By 11 September 2026",
    "Class test candidate": "",
    Details: "CW2 (75%) - Set Exercise\nDue: Friday 14th August 2026",
  },
  {
    "Module code": "COM745",
    "Module name": "Example Module B",
    Semester: "Three",
    Week: "Week 8",
    "Week commencing": "2026-07-20",
    Assessment: "CW1",
    Type: "presentation",
    Weight: "25%",
    Due: "Friday 24 July 2026",
    "Due date": "2026-07-24",
    Feedback: "By 21 August 2026",
    "Class test candidate": "",
    Details: "CW1 (25%) - Presentation (video submission)",
  },
];

const assessmentInstructions = [
  {
    Step: 1,
    Instruction: "Add one row per coursework item (class test, submission, presentation, etc.).",
  },
  {
    Step: 2,
    Instruction: "Type: classTest | presentation | submission | exam | other",
  },
  {
    Step: 3,
    Instruction: "Set Class test candidate = Yes for in-class / lab assessments.",
  },
  {
    Step: 4,
    Instruction: "Week commencing should be the Monday of that teaching week.",
  },
  {
    Step: 5,
    Instruction: "Upload after your timetable using Add another file, or start from both templates.",
  },
  {
    Step: 6,
    Instruction: "You can also upload the official QAHE matrix schedule — the dashboard reads both formats.",
  },
];

function writeWorkbook(filepath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filepath, buffer);
  console.log("Wrote", filepath);
}

writeWorkbook(path.join(templatesDir, "Timetable-template.xlsx"), [
  { name: "Instructions", rows: timetableInstructions },
  { name: "Timetable", rows: timetableRows },
]);

writeWorkbook(path.join(templatesDir, "Assessment-Schedule-template.xlsx"), [
  { name: "Instructions", rows: assessmentInstructions },
  { name: "Assessment items", rows: assessmentRows },
]);

writeWorkbook(path.join(sampleDir, "Timetable.xlsx"), [{ name: "Timetable", rows: timetableRows }]);

console.log("Done.");
