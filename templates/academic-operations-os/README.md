# Academic Operations OS — Semester Portal templates

The Assessment Operations Dashboard **creates these files automatically** when you run:

**Reports & Export → Create/Update Complete Semester Portal**

You do not need to pre-copy templates into the semester folder.

## Primary pages (user-facing)

| File | Role |
|------|------|
| `10 - Teaching Centre.md` | Day/Time Grid (full-duration blocks) · All Sessions table |
| `20 - Assessment Centre.md` | All Weeks, Week by Week, Calendar, Class Tests, All Assessments |

## Supporting data (`_Data/`)

Readable Markdown tables consumed by DataviewJS. Prefer the two centres for day-to-day use.

## Assets

`_Assets/academic-operations-os.css` — loaded by each portal page via DataviewJS (no Obsidian snippet setup required).

## Export modes

1. **Complete Semester Portal** — pages + `_Data` + CSS  
2. **Update Data Tables Only** — refreshes `_Data` only (leaves dashboards/CSS unchanged)

Manual notes outside `<!-- AOS:GENERATED:START -->` … `<!-- AOS:GENERATED:END -->` are preserved.

Student-level lookup remains in the Student Data application.
