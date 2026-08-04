/**
 * Fixture tests for assessment format + scheduling basis.
 * Run: node tests/assessment-format.test.mjs
 */
import {
  deriveAssessmentFormat,
  resolveSchedulingBasis,
  enrichAssessmentEvent,
  extractDueAndFeedback,
  parseUkDateFragment,
} from "../js/excel/assessment-format.js";

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

console.log("1. Practical assessment during Week 7 labs");
{
  const text = `CW1 Practical Skills Assessment (20%)
Due: During Week 7 lab classes
Feedback: By Week 9`;
  const format = deriveAssessmentFormat(text, "CW1 Practical Skills Assessment (20%)", "CW1");
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW1 Practical Skills Assessment (20%)",
    assessmentCode: "CW1",
    assessmentType: "classTest",
    weekCommencing: "2026-03-02",
    dueText: "During Week 7 lab classes",
    dueDate: "",
  });
  assertEq(format, "Practical Skills Assessment", "format");
  assertEq(event.schedulingBasis, "weekCommencing", "basis");
  assertEq(event.weekCommencing, "2026-03-02", "W/C kept");
  assertEq(event.exactDueDate, "", "no exact deadline");
}

console.log("2. Fixed report deadline");
{
  const text = `CW2 Report (40%)
Due: 15th May 2026
Feedback: By 12th June 2026`;
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW2 Report (40%)",
    assessmentCode: "CW2",
    assessmentType: "submission",
    weekCommencing: "2026-05-11",
    dueText: "15th May 2026",
    dueDate: "2026-05-15",
  });
  assertEq(event.assessmentFormat, "Report", "format");
  assertEq(event.schedulingBasis, "fixedDeadline", "basis");
  assertEq(event.exactDueDate, "2026-05-15", "exact date");
  assertEq(event.weekCommencing, "", "W/C blank for fixed deadline operational view");
}

console.log("3. Presentation throughout Week 12 with fixed slides deadline");
{
  const text = `CW1 Presentation (30%)
Due: Presentation slides by 1st August 2026
Presentation will be held throughout Week 12 in different groups
Feedback: By 22nd August 2026`;
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW1 Presentation (30%)",
    assessmentCode: "CW1",
    assessmentType: "presentation",
    weekCommencing: "2026-07-27",
    dueText: "Presentation slides by 1st August 2026",
    dueDate: "2026-08-01",
  });
  assertEq(event.assessmentFormat, "Presentation", "format");
  assertEq(event.schedulingBasis, "mixed", "mixed basis");
  assertEq(event.exactDueDate, "2026-08-01", "slides deadline");
  assertEq(event.weekCommencing, "2026-07-27", "W/C retained");
}

console.log("4. Research paper with secondary presentation-slide wording");
{
  const text = `CW2 Research Paper (50%)
Due: 20th June 2026
Include presentation slides as an appendix if relevant
Feedback of CW2: By 14th September 2026`;
  const format = deriveAssessmentFormat(text, "CW2 Research Paper (50%)", "CW2");
  const { feedbackText, dueText } = extractDueAndFeedback(text);
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW2 Research Paper (50%)",
    assessmentCode: "CW2",
    assessmentType: "submission",
    weekCommencing: "2026-06-15",
    dueText,
    dueDate: parseUkDateFragment(dueText),
  });
  assertEq(format, "Research Paper", "must not become Presentation");
  assertEq(event.assessmentFormat, "Research Paper", "enriched format");
  assert(feedbackText.toLowerCase().includes("september"), "feedback parsed separately");
  assertEq(event.schedulingBasis, "fixedDeadline", "fixed submission");
  assertEq(event.exactDueDate, "2026-06-20", "exact due");
}

console.log("5. Viva with group/slot-dependent dates");
{
  const text = `CW3 Viva / Oral Examination (20%)
Due: Individual slots throughout Week 10 in different groups
Feedback: Within 2 weeks`;
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW3 Viva / Oral Examination (20%)",
    assessmentCode: "CW3",
    assessmentType: "presentation",
    weekCommencing: "2026-04-20",
    dueText: "Individual slots throughout Week 10 in different groups",
    dueDate: "",
  });
  assertEq(event.assessmentFormat, "Viva / Oral Examination", "format");
  assertEq(event.schedulingBasis, "weekCommencing", "group-dependent");
  assertEq(event.exactDueDate, "", "no fixed date");
}

console.log("6. Malformed or missing dates");
{
  const text = `CW1 Set Exercise (10%)
Due: TBA
Feedback: TBC`;
  const event = enrichAssessmentEvent({
    rawText: text,
    title: "CW1 Set Exercise (10%)",
    assessmentCode: "CW1",
    assessmentType: "classTest",
    weekCommencing: "",
    dueText: "TBA",
    dueDate: "",
  });
  assertEq(event.assessmentFormat, "Set Exercise", "format");
  assertEq(event.schedulingBasis, "weekCommencing", "week-based format without dates still W/C basis");
  assertEq(event.exactDueDate, "", "no invented exact date");

  const empty = resolveSchedulingBasis({
    rawText: "Something unclear",
    assessmentFormat: "Other Assessment",
    weekCommencing: "",
    dueText: "",
    dueDate: "",
  });
  assertEq(empty.schedulingBasis, "notSpecified", "notSpecified when nothing known");
}

console.log("7. Never treat W/C copied into dueDate as exact deadline");
{
  const event = enrichAssessmentEvent({
    rawText: "CW1 Class Test\nDue: During Week 5 lab",
    title: "CW1 Class Test",
    assessmentCode: "CW1",
    assessmentType: "classTest",
    assessmentFormat: "Class Test / Lab",
    weekCommencing: "2026-02-09",
    dueText: "During Week 5 lab",
    dueDate: "2026-02-09", // legacy mistake
  });
  assertEq(event.schedulingBasis, "weekCommencing", "basis");
  assertEq(event.exactDueDate, "", "W/C must not become exact due");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
