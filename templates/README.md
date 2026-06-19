# Starter Excel templates

These files are safe to commit to GitHub — they contain **example data only**, not real timetables or assessment schedules.

| File | Purpose |
|------|---------|
| `Timetable-template.xlsx` | One row per teaching session. Replace example rows with your export. |
| `Assessment-Schedule-template.xlsx` | One row per coursework item (class tests, submissions, presentations). |

Each workbook includes an **Instructions** sheet with column guidance.

## Regenerating templates

If you change required columns in the app, update `scripts/generate-templates.mjs` and run:

```bash
node scripts/generate-templates.mjs
```

## Real data files

Do **not** commit your actual `Timetable.xlsx`, backups, or programme assessment schedules. They are excluded by `.gitignore`.
