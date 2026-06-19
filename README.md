# Assessment Operations Dashboard

A colleague-friendly tool for planning **class tests**, **invigilation**, **assessment deadlines**, and **rooms** across multiple campuses. Everything runs in your web browser — no installation required.

## Open the dashboard

### On GitHub Pages (recommended)

1. Open the link shared by your team (for example `https://your-org.github.io/assessment-dashboard/`).
2. Bookmark it for easy access.

### Local testing (developers)

From the project folder, start a simple web server (do not open `index.html` directly):

```bash
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/` in your browser.

## How to use it

The **welcome page** includes a full step-by-step guide and download links for starter templates.

### 1. Get your Excel files

- **Have exports already?** Upload your timetable and assessment schedule from your scheduling system.
- **Starting from scratch?** Download the templates from the welcome page (also in the [`templates/`](templates/) folder):
  - `Timetable-template.xlsx` — one row per session
  - `Assessment-Schedule-template.xlsx` — one row per coursework item

Replace the example rows with your real data in Excel, then upload.

### 2. Upload your timetable

When the page opens you will see:

**“Upload your timetable Excel file to begin.”**

- Drag and drop your Excel file onto the upload area, or click **Upload timetable**.
- Add the assessment schedule with **Add another file** (optional on first visit if you only have the timetable).
- Or click **Try sample timetable** to explore the dashboard first.

### 3. Plan class tests & assessments

1. Open **Check data** to confirm sessions imported correctly.
2. Use **Assessment hub** for the semester timeline, upcoming deadlines, and tasks/notes.
3. Go to **Seminar slots** and click **Mark as class test** for modules that need an in-class test.
4. Open **Class test plan** to fill in week, invigilator, room, and status.
5. Use **Invigilation** to see who is available or busy on each campus and day.

### 4. Save your workbook

Click **Save workbook** to download an Excel file with a timestamp in the filename (for example `Timetable 2026-06-19 15-30.xlsx`).

**To continue later:** upload that **saved workbook** only — it restores class test plans, assessment tracking, and notes. You do not need separate timetable and schedule files again.

## What to commit to GitHub

| Include | Exclude (`.gitignore`) |
|---------|-------------------------|
| App code (`js/`, `css/`, `index.html`) | `Timetable.xlsx` and backups |
| `templates/*.xlsx` (starter templates) | Real assessment schedule exports |
| `sample/Timetable.xlsx` (demo data) | Any other `.xlsx` at repo root |

Your real timetabling data should stay on your machine only.

## Expected Excel columns

The app recognises common column names automatically. Helpful columns include:

- Module code, Module name
- Campus, Weekday, Start time, End time
- Type (Lecture / Seminar) or Activity
- Staff (tutor), Student Groups, Size, Room

Extra columns are kept when you save. If something looks wrong after upload, check the yellow notice at the top of the page.

## Data privacy

**Your files never leave your computer.** The dashboard reads and writes Excel entirely in your browser. Nothing is uploaded to a server. This makes it safe to use with student timetabling data on your local machine or via GitHub Pages (which only hosts the app code, not your files).

## For administrators — GitHub Pages setup

1. Push this repository to GitHub (real data files are excluded by `.gitignore`).
2. Go to **Settings → Pages**.
3. Deploy from the **`main`** branch, folder **`/` (root)**.
4. Share the published URL with colleagues.

No build step, Python, or server configuration is required.

## Excel reader (online and offline)

The dashboard needs **SheetJS** to read and write Excel files. It loads automatically:

1. **Online** — from the SheetJS CDN (when internet is available)
2. **Offline** — from `vendor/xlsx/xlsx.mjs` included in this repository

If both fail, you will see: *“Excel reader could not load. Please check internet connection or use the offline version.”*

You can still click **Try sample timetable** to explore the dashboard using built-in sample data.

**For GitHub Pages:** commit the `vendor/xlsx/` folder so colleagues can use the tool without relying on the CDN.

To refresh the offline copy:

```bash
curl -L "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o vendor/xlsx/xlsx.mjs
```

## Sample timetable

Colleagues can click **Try sample timetable** on the welcome page to load `sample/Timetable.xlsx` (or a small built-in dataset if the file is unavailable). This is for learning the tool before uploading a real timetable

See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) for step-by-step manual tests before go-live.

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Upload does nothing | Ensure the file is `.xlsx` or `.xls` |
| Missing data after upload | Check the warning banner; confirm Module code, Campus, Weekday, and Staff columns exist |
| Plans not restored | Open the workbook you previously saved with **Save workbook**, not the original export |
| Blank page | Use a local web server or GitHub Pages — do not open `index.html` as a file URL |
| Blank page | Use a modern browser (Chrome, Edge, Firefox) and ensure JavaScript is enabled |
