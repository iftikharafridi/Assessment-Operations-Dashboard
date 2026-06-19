# SheetJS — offline copy

This folder contains a local copy of [SheetJS](https://sheetjs.com/) (v0.20.3) for reading and writing Excel files when the CDN is unavailable.

The app tries to load Excel support in this order:

1. CDN (`cdn.sheetjs.com`) — works when online
2. Local file (`vendor/xlsx/xlsx.mjs`) — offline fallback

If both fail, the dashboard shows a friendly message and the **Try sample timetable** button still works using built-in sample data.

To refresh this file:

```bash
curl -L "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o vendor/xlsx/xlsx.mjs
```

Include this folder in your GitHub repository so GitHub Pages works offline.
