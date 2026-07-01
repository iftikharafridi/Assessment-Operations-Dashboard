import { parseIsoDate } from "../analytics/assessment.js";

const MONTH_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SITE_NAMES = {
  BIR: "Birmingham",
  LND: "London",
  MAN: "Manchester",
  "LND IH": "London IH",
};

/**
 * Parse admission group labels such as "UU BIR Y1 CS 0126 Day A".
 * Cohort code MMYY — e.g. 0126 = January 2026 intake, 0526 = May 2026.
 * @param {string} label
 */
export function parseAdmissionGroup(label) {
  const raw = String(label || "").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts[0]?.toUpperCase() !== "UU") return { raw, parsed: false };

  const yearIdx = parts.findIndex((p) => /^Y\d$/i.test(p));
  const cohortIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
  const dayIdx = parts.findIndex((p) => /^Day$/i.test(p));
  if (yearIdx < 1 || cohortIdx <= yearIdx || dayIdx <= cohortIdx) return { raw, parsed: false };

  const siteCode = parts.slice(1, yearIdx).join(" ");
  const studyYear = parts[yearIdx].toUpperCase();
  const programme = parts.slice(yearIdx + 1, cohortIdx).join(" ");
  const cohortCode = parts[cohortIdx];
  const dayPattern = `${parts[dayIdx]} ${parts[dayIdx + 1] || ""}`.trim();

  const month = parseInt(cohortCode.slice(0, 2), 10);
  const yearSuffix = cohortCode.slice(2);
  const cohortYear = 2000 + parseInt(yearSuffix, 10);
  const cohortLabel =
    month >= 1 && month <= 12 ? `${MONTH_SHORT[month]} ${yearSuffix}` : cohortCode;

  return {
    raw,
    parsed: true,
    siteCode,
    siteName: SITE_NAMES[siteCode] || siteCode,
    studyYear,
    programme,
    cohortCode,
    cohortLabel,
    cohortMonth: month,
    cohortYear,
    dayPattern,
  };
}

/**
 * Estimate which semester of study a cohort is in (e.g. Jan 26 intake in Jun 26 → Semester 2 · Y1).
 * @param {number} cohortMonth 1–12 from cohort code
 * @param {number} cohortYear full year e.g. 2026
 * @param {string} semesterStartIso current teaching semester Week 1 w/c
 */
export function inferStudySemester(cohortMonth, cohortYear, semesterStartIso) {
  const start = parseIsoDate(semesterStartIso);
  if (!start || !cohortMonth || !cohortYear) {
    return { label: "", semester: null, studyYearLevel: null, semesterIndex: null };
  }

  const sm = start.getMonth() + 1;
  const sy = start.getFullYear();
  const monthsSinceIntake = (sy - cohortYear) * 12 + (sm - cohortMonth);
  const semesterIndex = Math.max(1, Math.ceil((monthsSinceIntake + 1) / 6));
  const semInYear = ((semesterIndex - 1) % 2) + 1;
  const yearOfStudy = Math.floor((semesterIndex - 1) / 2) + 1;

  return {
    label: `Semester ${semInYear} · Y${yearOfStudy}`,
    semester: semInYear,
    studyYearLevel: `Y${yearOfStudy}`,
    semesterIndex,
  };
}

/** @param {string[]} admissionGroups */
export function cohortMetaForGroups(admissionGroups, semesterStartIso = "") {
  const cohorts = admissionGroups.map((g) => {
    const base = parseAdmissionGroup(g);
    if (!base.parsed) return base;
    const study = inferStudySemester(base.cohortMonth, base.cohortYear, semesterStartIso);
    return { ...base, studySemester: study.semester, studySemesterLabel: study.label, studyYearLevel: study.studyYearLevel };
  });
  const primary = cohorts.find((c) => c.parsed) || cohorts[0] || null;
  return { cohorts, primary };
}

export function listCohortFilterOptions(items) {
  const campuses = new Set();
  const siteCodes = new Set();
  const cohortMap = new Map();
  const studyYears = new Set();
  const semesters = new Set();

  for (const item of items) {
    if (item.campus) campuses.add(item.campus);
    for (const c of item.cohorts || []) {
      if (!c.parsed) continue;
      siteCodes.add(c.siteCode);
      if (!cohortMap.has(c.cohortCode)) {
        cohortMap.set(c.cohortCode, c.cohortLabel || c.cohortCode);
      }
      studyYears.add(c.studyYear);
      if (c.studySemester != null) semesters.add(String(c.studySemester));
    }
  }

  return {
    campuses: [...campuses].sort(),
    siteCodes: [...siteCodes].sort(),
    cohortCodes: [...cohortMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, label]) => ({ code, label })),
    studyYears: [...studyYears].sort(),
    semesters: [...semesters].sort((a, b) => Number(a) - Number(b)),
  };
}

/** @param {import("../analytics/class-test-viz.js").ClassTestItem} item */
export function itemMatchesCohortFilters(item, filters = {}) {
  if (filters.campus && item.campus !== filters.campus) return false;

  const parsed = (item.cohorts || []).filter((c) => c.parsed);
  if (!filters.siteCode && !filters.cohortCode && !filters.studyYear && !filters.studySemester) {
    return true;
  }
  if (!parsed.length) return false;

  return parsed.some((c) => {
    if (filters.siteCode && c.siteCode !== filters.siteCode) return false;
    if (filters.cohortCode && c.cohortCode !== filters.cohortCode) return false;
    if (filters.studyYear && c.studyYear !== filters.studyYear) return false;
    if (filters.studySemester && String(c.studySemester) !== String(filters.studySemester)) return false;
    return true;
  });
}
