export function parseGroups(activity, studentGroups) {
  const grpMatch = String(activity || "").match(/GRP\s+([A-Z](?:\s*&\s*[A-Z])*)/i);
  const letterGroups = grpMatch
    ? grpMatch[1].split(/\s*&\s*/).map((g) => g.trim())
    : [];
  const admissionGroups = studentGroups
    ? String(studentGroups).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    letterGroups,
    admissionGroups,
    combined: letterGroups.length > 1 || admissionGroups.length > 1,
  };
}

export function typeBadge(type) {
  return type === "Seminar" ? "sem" : "lec";
}
