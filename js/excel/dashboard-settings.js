import { normalizeSemesterStartDate } from "../analytics/assessment.js";

export function buildDashboardSettingsRows(project) {
  const rows = [
    {
      Setting: "Semester start (Week 1 w/c)",
      Value: project.getSemesterStartDate?.() || "",
    },
  ];
  const hidden = project.getHiddenStudentGroups?.() || [];
  if (hidden.length) {
    rows.push({
      Setting: "Hidden student groups",
      Value: hidden.join("; "),
    });
  }
  return rows;
}

export function parseDashboardSettingsFromRows(rows) {
  const settings = { semesterStartDate: "", hiddenStudentGroups: [] };
  for (const row of rows) {
    const label = String(row.Setting ?? row.setting ?? "").trim().toLowerCase();
    const value = String(row.Value ?? row.value ?? "").trim();
    if (label.includes("semester start")) {
      settings.semesterStartDate = normalizeSemesterStartDate(value);
      continue;
    }
    if (label.includes("hidden student groups") && value) {
      settings.hiddenStudentGroups = value
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return settings;
}
