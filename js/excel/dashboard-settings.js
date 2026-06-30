import { normalizeSemesterStartDate } from "../analytics/assessment.js";

export function buildDashboardSettingsRows(project) {
  return [
    {
      Setting: "Semester start (Week 1 w/c)",
      Value: project.getSemesterStartDate?.() || "",
    },
  ];
}

export function parseDashboardSettingsFromRows(rows) {
  const settings = { semesterStartDate: "" };
  for (const row of rows) {
    const label = String(row.Setting ?? row.setting ?? "").trim().toLowerCase();
    if (!label.includes("semester start")) continue;
    settings.semesterStartDate = normalizeSemesterStartDate(row.Value ?? row.value ?? "");
  }
  return settings;
}
