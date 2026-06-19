import { ASSESSMENT_STATUSES } from "../config/constants.js";

export const DEFAULT_ASSESSMENT_RECORD = {
  status: "Not started",
  tasks: "",
  notes: "",
};

export function normalizeAssessmentRecord(raw = {}) {
  const record = { ...DEFAULT_ASSESSMENT_RECORD, ...raw };
  if (!ASSESSMENT_STATUSES.includes(record.status)) record.status = "Not started";
  record.tasks = String(record.tasks ?? "");
  record.notes = String(record.notes ?? "");
  return record;
}

export function createEmptyAssessmentTracking() {
  return {
    semesterStartDate: "",
    records: {},
  };
}
