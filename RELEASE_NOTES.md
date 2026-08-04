# Release Notes — Assessment Operations Dashboard

## v2.3.0 — Semester Operations Portal export (July 2026)

### Highlights

- **Create/Update Complete Semester Portal** writes a compact Obsidian site from this app’s timetable, modules, teaching team, assessments, class tests, invigilation, and issues.
- Three primary pages reduced to Teaching + Assessment centres with sticky nav and in-page view toolbars (DataviewJS).
- Supporting tables in `_Data/`; shared CSS in `_Assets/academic-operations-os.css`.
- **Update Data Tables Only** refreshes `_Data` without touching the four dashboards or CSS.
- Generated content sits between `<!-- AOS:GENERATED:START/END -->` markers; manual notes outside are preserved; timestamped backups on update.
- Assessment matrix parser now captures Course/programme, CRN, Module coordinator, and QAHE module leader when present.
- Legacy two-file export (`03 - Assessment/20…` / `22…`) kept for one release under a details panel.
- Student-level lookup remains out of scope (Student Data app).

### Tests

```bash
node tests/academic-os-portal.test.mjs
node tests/academic-os-md.test.mjs
node tests/assessment-format.test.mjs
```

---

## v2.2.0 — Academic Operations OS export (July 2026)

### Highlights

- New **Export to Academic Operations OS** on Reports & Export.
- Selects your Obsidian **semester folder**, then updates:
  - `03 - Assessment/20 - Assessment Schedule.md`
  - `03 - Assessment/22 - Class Test Schedule.md`
- Timestamped `.backup-…md` before each write; only Markdown **table rows** are replaced.
- Assessment scheduling: W/C, Fixed deadline, Mixed; operational weeks may be outside 1–12.
- Reference templates under `templates/academic-operations-os/`.
- Existing Excel / CSV / Obsidian ZIP exports unchanged.

### Tests

```bash
node tests/academic-os-md.test.mjs
node tests/assessment-format.test.mjs
```

---

## v2.1.0 — Simplified assessment schedule & Obsidian export (July 2026)

### Highlights

- **Assessment format** replaces generic labels such as “Submission / deadline” with specific formats (Report, Research Paper, Practical Skills Assessment, Presentation, Viva, etc.).
- **Scheduling basis** clearly separates:
  - **Week commencing (W/C)** — group/timetable-dependent (class tests, labs, presentations throughout a week)
  - **Fixed deadline** — one common submission date for all groups
  - **Mixed** — both (e.g. slides by a fixed date + presentations throughout the week)
- New Assessments sub-view: **Simplified Schedule** (KPIs, filters, colour accents).
- New Excel sheet: **`Assessment Schedule - Simple`**.
- New export: **Export Obsidian Assessment Schedule** (ZIP with CSV + DataviewJS note).
- Semester values remain **numeric** (`1`, `2`, `3`).
- Teaching-week W/C is never treated as an exact deadline just because it was copied into `dueDate`.

### Compatibility

- Older saved workbooks still load; missing format/scheduling fields are derived on read.
- Existing **Assessment Events** and **Assessment Tracking** sheets are retained.
- Class-test candidate detection is unchanged.

### Tests

```bash
node tests/assessment-format.test.mjs
```

---

# Release Notes — Assessment Operations Dashboard v1.0.1

**Release date:** June 2026  
**Status:** Pilot release for colleague testing

---

## What the app does

The Assessment Operations Dashboard helps teams plan **class tests** across multiple campuses. It lets you:

- Upload a timetable Excel file and view sessions by campus, day, and tutor
- Identify **seminar slots** suitable for in-class tests
- Plan test week, date, time, room, and readiness (paper, LOD/software)
- Assign **extra invigilators** and check tutor availability
- Spot possible **conflicts** (rooms, tutors, invigilators)
- **Save workbook** — download an Excel file with your plans and summary reports
- **Reopen** a saved workbook later and continue where you left off

Everything runs in your web browser. No installation or server setup is required for end users.

---

## Who it is for

This tool is designed for:

- **Assessment operations staff** coordinating class tests across campuses
- **Programme leaders and module leads** reviewing test schedules
- **Campus coordinators** assigning invigilators and rooms
- **Administrators** preparing approval packs and shared Excel reports

It supports multi-campus delivery (for example London RAV, London IH, Birmingham LRH, Manchester) and combined student groups (e.g. Grp B & C).

---

## How to use it

1. **Open the dashboard** — use your team’s GitHub Pages link or hosted copy of the site.
2. **Upload timetable** — drag and drop your Excel file, or click **Upload timetable**.  
   Or click **Try sample timetable** to explore first.
3. **Check data** — open the **Check data** tab and confirm sessions, campuses, tutors, and seminar counts look correct.
4. **Mark class tests** — on **Seminar slots** or **Class test plan**, click **Mark as class test** for each module that needs a test.
5. **Complete the plan** — add test week, date, times, duration, status, room, invigilator, and readiness flags.
6. **Review invigilation** — use the **Invigilation** tab to see who is available or busy on each campus and day.
7. **Save workbook** — download the Excel file with your plans and reports.
8. **Reopen later** — upload the **saved workbook** (not the original export) to restore your plans.

Click **How to use** in the header anytime for a quick in-app guide.

For detailed testing steps, see [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md).

---

## What changed in v1.0.1

This release focuses on **colleague testing and stability** (no major new modules).

### New in v1.0.1

| Feature | Description |
|---------|-------------|
| **Safer Excel reader** | Loads SheetJS from CDN when online, with a local offline copy in `vendor/xlsx/`. Friendly error if both fail. |
| **Try sample timetable** | Demo button on the welcome page; loads `sample/Timetable.xlsx` or a built-in sample dataset. |
| **How to use guide** | In-app help button with step-by-step workflow. |
| **Version label** | Footer shows **Version 1.0.1**. |
| **Pilot testing pack** | Updated [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) and offline setup notes in [README.md](README.md). |

### Carried forward from v1.0

- Client-side dashboard (GitHub Pages compatible)
- Weekly timetable view with campus grouping and colour coding
- Class test plan with bulk actions, filters, and stable session IDs for save/reopen
- **Check data** validation tab (green / amber / red indicators)
- Excel export with planning sheets and colleague-friendly reports
- Colleague-friendly wording throughout the UI

---

## Known limitations

- **Browser-only** — requires a modern browser (Chrome, Edge, or Firefox). Very old browsers are not supported.
- **Excel format** — expects a timetable export with recognisable columns (Module code, Campus, Weekday, Staff, etc.). Unusual layouts may need column mapping review in **Check data**.
- **No live sync** — changes are not shared between users automatically. Share the saved workbook file for collaboration.
- **No email or calendar integration** — planning is manual within the dashboard and exported Excel.
- **Invigilation logic is advisory** — availability is based on the uploaded timetable; it does not connect to HR or room booking systems.
- **Large files** — very large timetables may be slower to load depending on device and browser.
- **Save requires Excel reader** — if the Excel reader fails to load, you can still use **Try sample timetable**, but uploading and saving your own files requires the reader (CDN or offline copy).

---

## Data privacy

**Your files stay on your computer.**

- Timetable and planning data are processed **entirely in your browser**.
- Nothing is uploaded to a server when you use the dashboard.
- GitHub Pages only hosts the **application code** — not your Excel files.
- Saved workbooks are downloaded to your device; you control where they are stored and shared.

Do not commit real timetable files containing personal data to public repositories unless your organisation’s data policy allows it.

---

## Recommended pilot testing steps

Use this short pilot before wider rollout:

1. Open the published dashboard and confirm **Version 1.0.1** appears in the footer.
2. Click **Try sample timetable** and explore Overview, Check data, and Seminar slots.
3. Upload a real **Timetable.xlsx** and confirm counts in **Check data**.
4. Mark 2–3 seminars as class tests; assign test week, invigilator, and status.
5. Deliberately create a conflict (same invigilator or room) and confirm it appears on Overview / Check data.
6. Click **Save workbook** and open the file in Excel — confirm sheets are readable.
7. Refresh the browser and **reopen the saved workbook** — confirm plans restore correctly.
8. Ask one colleague on a different campus to repeat steps 3–7 with their timetable.

Full checklist: [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)

---

## Future roadmap

### v1.1 — Reports polish (planned)

- Refine exported report layouts and wording for formal approval packs
- Improved print-friendly views
- Additional summary filters and export options
- Bug fixes and usability improvements from pilot feedback

### v2.0 — Campus map and room layout designer (planned)

- Visual **campus map** for room and test location planning
- **Room layout designer** for seating and invigilation placement
- Deeper integration with room capacity and campus-specific constraints

Other areas under consideration for later releases: LOD readiness, Blackboard readiness, attendance tracking, workload analysis, and exam planning modules.

---

## Support and feedback

During the pilot, please note:

- What worked well
- Any confusing steps or wording
- Issues with your specific timetable format
- Features needed before wider adoption

Share feedback with your assessment operations lead so it can inform v1.1.

---

*Assessment Operations Dashboard v1.0.1 — pilot release for colleague testing*
