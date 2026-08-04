/**
 * Human-readable assessment format + scheduling basis for assessment events.
 * Keeps internal assessmentType for filtering / class-test logic.
 */

/** Specific format labels — order matters: most specific first. */
const FORMAT_RULES = [
  { re: /practical skills assessment/i, label: "Practical Skills Assessment" },
  { re: /set exercise/i, label: "Set Exercise" },
  { re: /video presentation/i, label: "Video Presentation" },
  { re: /viva|oral examination|oral exam/i, label: "Viva / Oral Examination" },
  { re: /project proposal/i, label: "Project Proposal" },
  { re: /group project/i, label: "Group Project" },
  { re: /research paper/i, label: "Research Paper" },
  { re: /written assignment/i, label: "Written Assignment" },
  { re: /performance\s*\/?\s*proforma|proforma/i, label: "Performance / Proforma" },
  { re: /portfolio/i, label: "Portfolio" },
  { re: /report\s*\+\s*code|report and code|code and report/i, label: "Report + Code" },
  { re: /\breport\b/i, label: "Report" },
  { re: /\bproject\b/i, label: "Project" },
  { re: /class test|lab class|during week \d+ lab/i, label: "Class Test / Lab" },
  { re: /\bpresentation\b/i, label: "Presentation" },
  { re: /\bexam\b/i, label: "Exam" },
];

export const SCHEDULING_BASIS_LABELS = {
  weekCommencing: "Week commencing",
  fixedDeadline: "Fixed deadline",
  mixed: "Mixed",
  notSpecified: "Not specified",
};

export function parseUkDateFragment(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw.slice(0, 10);

  const match = raw.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!match) return "";

  const months = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return "";
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
}

export function extractMainTitleLine(text) {
  const lines = String(text ?? "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  const cwLine = lines.find((l) => /^(CW\d[ab]?)\b/i.test(l));
  return cwLine || lines[0];
}

/**
 * Derive a human-readable assessment format from the title/component first,
 * then the full block. Secondary wording must not override the main title.
 */
export function deriveAssessmentFormat(eventText, titleLine = "", assessmentCode = "") {
  void assessmentCode;
  const title = String(titleLine || "").trim();
  const full = String(eventText || "").trim();

  const titleBody = title
    .replace(/^(CW\d[ab]?)\b[:\s-]*/i, "")
    .replace(/\(\d+(?:\.\d+)?\s*%\)/g, "")
    .trim();

  for (const rule of FORMAT_RULES) {
    if (rule.re.test(titleBody) || rule.re.test(title)) return rule.label;
  }

  if (/written assignment/i.test(titleBody) && /\[\s*\d[\d\w\s-]*word\s+report/i.test(full)) {
    return "Report";
  }

  for (const rule of FORMAT_RULES) {
    if (rule.re.test(full)) return rule.label;
  }

  return "Other Assessment";
}

/**
 * Collect Due: segments and Feedback without treating feedback dates as due dates.
 */
export function extractDueAndFeedback(text) {
  const raw = String(text ?? "");
  const dueParts = [];
  const dueRe = /\bDue:\s*/gi;
  let match;
  while ((match = dueRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const rest = raw.slice(start);
    const endMatch = rest.search(/\n\s*(?:Due:|Feedback(?:\s+of\s+CW\d[ab]?)?\s*:|Feedback\s+by\b)/i);
    const chunk = (endMatch >= 0 ? rest.slice(0, endMatch) : rest).trim().replace(/\s+/g, " ");
    if (chunk) dueParts.push(chunk);
  }

  let feedbackText = "";
  const feedbackMatch = raw.match(
    /Feedback(?:\s+of\s+CW\d[ab]?)?\s*:\s*([\s\S]*?)(?=\n\s*(?:Due:|CW\d)|$)/i
  );
  if (feedbackMatch) {
    feedbackText = feedbackMatch[1].trim().replace(/\s+/g, " ");
  } else {
    const byMatch = raw.match(/Feedback\s+by\s+([\s\S]*?)(?=\n\s*(?:Due:|CW\d)|$)/i);
    if (byMatch) feedbackText = byMatch[1].trim().replace(/\s+/g, " ");
  }

  return {
    dueText: dueParts.join(" | "),
    dueParts,
    feedbackText,
  };
}

function firstExactDateInParts(parts) {
  for (const part of parts) {
    const d = parseUkDateFragment(part);
    if (d) return d;
  }
  return "";
}

function textImpliesGroupWeekScheduling(text) {
  const t = String(text ?? "").toLowerCase();
  return (
    /throughout\s+(?:week|the week)/i.test(t) ||
    /different groups/i.test(t) ||
    /in (?:their|each|different) (?:seminar|lab|group|slot)/i.test(t) ||
    /during week \d+ lab/i.test(t) ||
    /week \d+ lab/i.test(t) ||
    /individual slots?/i.test(t) ||
    /group[-\s]?dependent/i.test(t) ||
    /held throughout/i.test(t) ||
    /timetable slots?/i.test(t)
  );
}

/**
 * @returns {{ schedulingBasis: string, weekCommencing: string, exactDueDate: string }}
 */
export function resolveSchedulingBasis(event) {
  const full = `${event.rawText || ""} ${event.dueText || ""} ${event.title || ""}`;
  const weekCommencing = String(event.weekCommencing || "").slice(0, 10);
  const dueParts = String(event.dueText || "")
    .split(/\s*\|\s*/)
    .filter(Boolean);
  let exactDueDate = firstExactDateInParts(dueParts);
  if (!exactDueDate) exactDueDate = parseUkDateFragment(event.dueText);
  const storedDue = String(event.dueDate || event.exactDueDate || "").slice(0, 10);
  // Never treat teaching-week W/C copied into dueDate as an exact deadline.
  if (!exactDueDate && storedDue && storedDue !== weekCommencing) {
    exactDueDate = storedDue;
  }

  const groupWeek = textImpliesGroupWeekScheduling(full);
  const format = event.assessmentFormat || "";
  const type = event.assessmentType || "";
  const formatIsWeekBased =
    /Practical Skills|Set Exercise|Class Test|Presentation|Video Presentation|Viva/i.test(format) ||
    type === "classTest" ||
    type === "presentation";

  const hasExact = Boolean(exactDueDate);
  const hasWc = Boolean(weekCommencing);
  const weekBased = groupWeek || (formatIsWeekBased && !hasExact);

  if (hasExact && (groupWeek || (formatIsWeekBased && /presentation|viva|slides|throughout/i.test(full)))) {
    if (groupWeek || /presentation|viva|throughout/i.test(full)) {
      return { schedulingBasis: "mixed", weekCommencing, exactDueDate };
    }
  }

  if (hasExact && !groupWeek && !weekBased) {
    return { schedulingBasis: "fixedDeadline", weekCommencing: "", exactDueDate };
  }

  if (hasExact && weekBased && !groupWeek) {
    if (/Report|Written Assignment|Research Paper|Project|Portfolio|Exam/i.test(format)) {
      return { schedulingBasis: "fixedDeadline", weekCommencing: "", exactDueDate };
    }
  }

  if (weekBased || (hasWc && !hasExact)) {
    return {
      schedulingBasis: "weekCommencing",
      weekCommencing: weekCommencing || "",
      exactDueDate: "",
    };
  }

  if (hasExact) {
    return { schedulingBasis: "fixedDeadline", weekCommencing: "", exactDueDate };
  }

  if (hasWc) {
    return { schedulingBasis: "weekCommencing", weekCommencing, exactDueDate: "" };
  }

  return { schedulingBasis: "notSpecified", weekCommencing: "", exactDueDate: "" };
}

/** Enrich an event with format / scheduling fields. Safe for older imported events. */
export function enrichAssessmentEvent(event) {
  if (!event) return event;
  const titleLine = event.title || extractMainTitleLine(event.rawText);
  const assessmentFormat =
    event.assessmentFormat && event.assessmentFormat !== "Submission / deadline"
      ? event.assessmentFormat
      : deriveAssessmentFormat(event.rawText, titleLine, event.assessmentCode);
  const scheduling = resolveSchedulingBasis({ ...event, assessmentFormat, title: titleLine });
  return {
    ...event,
    title: titleLine || event.title,
    assessmentFormat,
    schedulingBasis: scheduling.schedulingBasis,
    weekCommencing:
      scheduling.schedulingBasis === "fixedDeadline"
        ? scheduling.weekCommencing || ""
        : scheduling.weekCommencing || String(event.weekCommencing || "").slice(0, 10),
    exactDueDate: scheduling.exactDueDate,
  };
}

export function enrichAssessmentEvents(events) {
  return (events || []).map(enrichAssessmentEvent);
}

export function resolveAssessmentDateFields(event) {
  const enriched = enrichAssessmentEvent(event);
  const basis = enriched.schedulingBasis || "notSpecified";
  const dateType =
    basis === "fixedDeadline"
      ? "Exact date"
      : basis === "weekCommencing"
        ? "Week commencing"
        : basis === "mixed"
          ? "Mixed"
          : "Not specified";

  return {
    weekCommencing: enriched.weekCommencing || "",
    exactDueDate: enriched.exactDueDate || "",
    dateType,
    planningDate: enriched.exactDueDate || enriched.weekCommencing || "",
    schedulingBasis: basis,
  };
}
