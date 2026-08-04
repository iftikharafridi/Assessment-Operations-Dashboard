/**
 * Tests for Academic Operations OS Markdown table replacement.
 * Run: node tests/academic-os-md.test.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  escapeMdCell,
  formatIsoDate,
  replaceMatchingTableRows,
  parseTableRow,
  headersMatch,
  stampForBackup,
} from "../js/obsidian/md-table.js";
import { parseOperationalWeek } from "../js/obsidian/academic-os-rows.js";
import {
  ASSESSMENT_SCHEDULE_MD_HEADERS,
  CLASS_TEST_SCHEDULE_MD_HEADERS,
} from "../js/obsidian/academic-os-contract.js";
import { enrichAssessmentEvent } from "../js/excel/assessment-format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

console.log("1. Pipe escaping and line breaks");
{
  assertEq(escapeMdCell("a|b"), "a\\|b", "escape pipe");
  assertEq(escapeMdCell("line1\nline2"), "line1<br>line2", "newline to br");
  assertEq(escapeMdCell("x\r\ny"), "x<br>y", "crlf to br");
}

console.log("2. ISO dates");
{
  assertEq(formatIsoDate("2026-07-23T12:00:00"), "2026-07-23", "iso slice");
  assertEq(formatIsoDate(new Date("2026-03-10T12:00:00")), "2026-03-10", "Date object");
}

console.log("3. Operational weeks outside 1–12");
{
  assertEq(parseOperationalWeek("Week -2"), "-2", "week -2");
  assertEq(parseOperationalWeek("Week 0"), "0", "week 0");
  assertEq(parseOperationalWeek("Week 14"), "14", "week 14");
  assertEq(parseOperationalWeek(15), "15", "numeric 15");
}

console.log("4. Table replacement preserves surrounding content");
{
  const md = `# Title

Intro text

| Status | Module code | Module name | Semester | Operational week | Cohort week | Assessment | Assessment format | Weight | Scheduling basis | W/C | Fixed deadline | Feedback date | Campus | Cohort | Group | Room | Start time | End time | Tutor / assessor | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Planned | OLD | Old name | S1 2026 | 1 |  | CW1 | Report | 10% | Fixed deadline |  | 2026-01-01 |  |  |  |  |  |  |  |  |  |

\`\`\`dataviewjs
console.log("keep me");
\`\`\`

## Manual notes
Keep this.
`;
  const row = [
    "Planned",
    "COM759",
    "Module|Name",
    "S3 2026",
    "14",
    "",
    "CW2",
    "Research Paper",
    "50%",
    "Mixed",
    "2026-07-27",
    "2026-08-01",
    "2026-09-14",
    "Birmingham",
    "May 2026",
    "A",
    "",
    "",
    "",
    "",
    "line1\nline2",
  ];
  const result = replaceMatchingTableRows(md, ASSESSMENT_SCHEDULE_MD_HEADERS, [row]);
  assert(result.ok, "replace ok");
  assertEq(result.rowsWritten, 1, "one row written");
  assert(result.markdown.includes("Intro text"), "preserves intro");
  assert(result.markdown.includes("dataviewjs"), "preserves dataview");
  assert(result.markdown.includes("Manual notes"), "preserves notes");
  assert(result.markdown.includes("Module\\|Name"), "escaped pipe in cell");
  assert(result.markdown.includes("line1<br>line2"), "br in notes");
  assert(!result.markdown.includes("| OLD |"), "old row removed");
  assert(result.markdown.includes("| COM759 |"), "new row present");
  assert(result.markdown.includes("| 14 |"), "week 14 kept");
}

console.log("5. Skipped rows with wrong cell count");
{
  const md = `| A | B |
| --- | --- |
| 1 | 2 |
`;
  const result = replaceMatchingTableRows(md, ["A", "B"], [["only-one"], ["1", "2"]]);
  assert(result.ok, "replace still ok");
  assertEq(result.rowsWritten, 1, "one valid row");
  assertEq(result.skippedRows, 1, "one skipped");
}

console.log("6. Missing table / invalid folder contract headers");
{
  const md = `# No table here\n`;
  const result = replaceMatchingTableRows(md, ASSESSMENT_SCHEDULE_MD_HEADERS, []);
  assert(!result.ok, "fails when table missing");
  assert(result.error.includes("No Markdown table"), "error message");
}

console.log("7. Template files match contracts");
{
  const assessPath = path.join(
    root,
    "templates/academic-operations-os/03 - Assessment/20 - Assessment Schedule.md"
  );
  const classPath = path.join(
    root,
    "templates/academic-operations-os/03 - Assessment/22 - Class Test Schedule.md"
  );
  const assessMd = fs.readFileSync(assessPath, "utf8");
  const classMd = fs.readFileSync(classPath, "utf8");
  const assessHeader = assessMd
    .split("\n")
    .find((l) => l.includes("Module code") && l.includes("Operational week"));
  const classHeader = classMd
    .split("\n")
    .find((l) => l.includes("Module code") && l.includes("Test type"));
  assert(
    headersMatch(parseTableRow(assessHeader), ASSESSMENT_SCHEDULE_MD_HEADERS),
    "assessment template headers"
  );
  assert(
    headersMatch(parseTableRow(classHeader), CLASS_TEST_SCHEDULE_MD_HEADERS),
    "class test template headers"
  );

  const cleared = replaceMatchingTableRows(assessMd, ASSESSMENT_SCHEDULE_MD_HEADERS, []);
  assert(cleared.ok && cleared.rowsWritten === 0, "empty optional fields / clear table");
}

console.log("8. Mixed assessment enrichment");
{
  const event = enrichAssessmentEvent({
    rawText:
      "CW1 Presentation (30%)\nDue: Presentation slides by 1st August 2026\nPresentation will be held throughout Week 12 in different groups",
    title: "CW1 Presentation (30%)",
    assessmentCode: "CW1",
    assessmentType: "presentation",
    weekCommencing: "2026-07-27",
    weekNumber: 12,
    dueText: "Presentation slides by 1st August 2026",
    dueDate: "2026-08-01",
  });
  assertEq(event.schedulingBasis, "mixed", "mixed basis");
  assert(event.exactDueDate === "2026-08-01", "fixed deadline present");
  assert(event.weekCommencing === "2026-07-27", "W/C present");
}

console.log("9. Backup stamp format");
{
  const stamp = stampForBackup(new Date("2026-07-23T15:04:05"));
  assert(/^\d{8}-\d{6}$/.test(stamp), "backup stamp shape");
}

console.log("10. UTF-8 module names round-trip in escape");
{
  const name = "Résumé & データ";
  assertEq(escapeMdCell(name), name, "utf8 preserved");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
