/**
 * Refresh only portal pages + CSS in an existing semester vault (keeps _Data).
 * Usage: node scripts/refresh-portal-pages.mjs "D:\path\to\semester folder"
 */
import fs from "node:fs";
import path from "node:path";
import { Project } from "../js/model/project.js";
import { buildPortalFiles, applyGeneratedContent } from "../js/obsidian/portal/export.js";
import {
  PORTAL_MODE_COMPLETE,
  PORTAL_PAGE_PATHS,
  PORTAL_ASSET_PATHS,
} from "../js/obsidian/portal/paths.js";

const vault = process.argv[2];
if (!vault) {
  console.error("Pass the semester folder path.");
  process.exit(1);
}

const project = new Project("Semester");
const built = buildPortalFiles(project, {
  mode: PORTAL_MODE_COMPLETE,
  exportedAt: new Date().toLocaleString(),
});

const wanted = new Set([
  PORTAL_PAGE_PATHS.teachingCentre,
  PORTAL_PAGE_PATHS.assessmentCentre,
  PORTAL_ASSET_PATHS.css,
]);

for (const file of built.files.filter((f) => wanted.has(f.path))) {
  const full = path.join(vault, ...file.path.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const existing = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
  const applied = applyGeneratedContent(existing, file.title, file.generated, {
    rawFile: file.kind === "asset",
  });
  fs.writeFileSync(full, applied.markdown, "utf8");
  console.log("Updated", file.path);
}

for (const stale of ["00 - Semester Manager.md", "30 - Operations Centre.md"]) {
  const full = path.join(vault, stale);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log("Removed", stale);
  }
}

const readme = `# Academic Operations OS — Semester Portal

## Portal pages
- [[10 - Teaching Centre]]
- [[20 - Assessment Centre]]

Generated data lives in \`_Data/\`. Styles live in \`_Assets/academic-operations-os.css\` (loaded automatically by Dataview).

## How to view interactive dashboards
1. Enable the **Dataview** community plugin (with JavaScript queries allowed).
2. Open a portal page in **Reading view** (not Live Preview).
3. Teaching: **Day/Time Grid** (blocks span full session duration) or **All Sessions**.
4. Assessments: **All Weeks / Week by Week / Calendar**, plus **Class Tests**.

## Re-export from the Operations Dashboard
Use **Create/Update Complete Semester Portal** and pick this folder. Data-only updates refresh \`_Data/\` without rewriting pages.
`;

fs.writeFileSync(path.join(vault, "README.md"), readme, "utf8");
fs.writeFileSync(
  path.join(vault, "START HERE.md"),
  `# START HERE

Start with **[[10 - Teaching Centre]]**.

Then open **[[20 - Assessment Centre]]** for assessments and class tests.

Enable **Dataview** and use **Reading view**.
`,
  "utf8"
);

console.log("README + START HERE updated");
console.log("Vault:", vault);
