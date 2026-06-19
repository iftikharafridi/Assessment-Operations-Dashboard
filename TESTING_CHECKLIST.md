# Manual Testing Checklist — Assessment Operations Dashboard v1.0.1

Use this checklist before sharing the dashboard with colleagues or publishing to GitHub Pages.

## Setup

- [ ] Open the dashboard in Chrome or Edge (latest version)
- [ ] Confirm the landing page shows **“Upload your timetable Excel file to begin.”**
- [ ] Confirm the footer shows **Version 1.0.1**
- [ ] Click **How to use** — guide opens with all six steps
- [ ] Confirm there is no mention of localhost, Python, JSON, or technical setup in normal screens

## 0. Sample mode (new in 1.0.1)

- [ ] Click **Try sample timetable** on the welcome page
- [ ] Dashboard loads with sample data and a notice that it is a demonstration
- [ ] Explore Overview, Check data, and Seminar slots without uploading your own file

## 1. Upload original Timetable.xlsx

- [ ] Click **Upload timetable** or drag `Timetable.xlsx` onto the upload area
- [ ] Dashboard loads without errors
- [ ] Overview tab shows summary cards with non-zero session counts
- [ ] Loaded files list shows the timetable filename

## 2. Check imported counts

- [ ] Open **Check data** tab
- [ ] Verify counts match expectations:
  - Sessions imported
  - Campuses (e.g. London RAV, Birmingham LRH, Manchester, London IH)
  - Modules
  - Tutors
  - Seminar slots
- [ ] Required columns check is green or shows a clear amber warning (not a silent failure)
- [ ] Missing campus / missing tutor / unclear time checks are green for a clean file

## 3. Mark seminar as class test

- [ ] Open **Seminar slots**
- [ ] Click **Mark as class test** on one seminar row
- [ ] Status updates to Planning (or equivalent)
- [ ] Open **Class test plan** tab — the row appears with seminar times pre-filled
- [ ] Fill in: Test week, Test date (optional), Start time, Duration (minutes)
- [ ] Confirm end time updates automatically when duration is entered

## 4. Assign invigilator

- [ ] In **Class test plan**, select an invigilator from the same campus dropdown
- [ ] Open **Invigilation** tab for that campus and day
- [ ] Confirm tutor shows as Available or Busy with clear guidance text
- [ ] If invigilator teaches at the same time, a warning appears on the plan row

## 5. Trigger conflict

- [ ] Mark two seminars as class tests with the same room and overlapping times, **or**
- [ ] Assign the same invigilator to two overlapping tests
- [ ] Overview shows increased **Conflicts** count
- [ ] **Check data** tab shows red indicator for invigilator conflicts or room clashes
- [ ] Filter sidebar: tick **Possible issues only** — only conflicting rows appear in views

## 6. Bulk actions

- [ ] Open **Seminar slots** or **Class test plan**
- [ ] Select two or more rows using checkboxes
- [ ] Bulk bar appears
- [ ] **Mark as class test** applies to all selected rows
- [ ] **Set week** applies the same test week to all selected
- [ ] **Clear class test** removes the flag from selected rows

## 7. Filters (consistent across views)

- [ ] Set Campus filter — Overview, Timetable, Seminar slots, Class test plan, and Invigilation all reflect the filter
- [ ] Set Weekday, Module code, Tutor filters — views update consistently
- [ ] Tick **Needs invigilator only** — only planned tests without an invigilator show
- [ ] Click **Clear filters** — all views reset

## 8. Save workbook

- [ ] Click **Save workbook**
- [ ] Excel file downloads (`.xlsx`)
- [ ] Open in Excel and confirm sheets exist:
  - Original timetable sheet (unchanged data)
  - Class Test Plans (with Stable session ID column)
  - Invigilation Plan
  - Dashboard Summary (includes export date/time)
  - Class Test Schedule
  - Missing Invigilators
  - Campus Summary
  - Tutor Workload
  - `_ProjectMeta`
- [ ] Planning sheets have readable column widths and a frozen header row

## 9. Reopen saved workbook

- [ ] Start fresh (refresh the browser page)
- [ ] Upload the **saved** workbook (not the original export)
- [ ] Class test plans are restored on the correct seminar rows
- [ ] **Check data** → “Saved plans matched” is green
- [ ] Edit a plan, save again — no duplicate planning sheets accumulate in the file

## 10. Unmatched plans (optional)

- [ ] Save a workbook with class test plans
- [ ] Edit the original timetable (change a module code or time) and re-upload
- [ ] **Check data** shows amber warning for unmatched saved plans
- [ ] Unmatched plan details are listed — data is not silently deleted

## 11. GitHub Pages

- [ ] Push repository to GitHub (include `vendor/xlsx/` and `sample/` folders)
- [ ] Enable Pages from `main` branch, root folder
- [ ] Open published URL — app loads from site root (`index.html`, `css/`, `js/` paths work)
- [ ] Upload timetable — all features work on the published site
- [ ] Save workbook, reopen it — class test plans restore correctly
- [ ] Confirm exported Excel sheets are readable (headers, column widths, filters)
- [ ] Confirm files are processed locally (no upload to a server)

## 12. Offline Excel reader (optional)

- [ ] Block CDN in browser dev tools or disconnect internet
- [ ] Refresh page — app loads using `vendor/xlsx/xlsx.mjs`
- [ ] If both CDN and local fail, friendly error message appears
- [ ] **Try sample timetable** still works via built-in data

## Sign-off

| Tester | Date | Result | Notes |
|--------|------|--------|-------|
|        |      |        |       |
