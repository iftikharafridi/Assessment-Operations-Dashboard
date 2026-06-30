# SheetJS — offline copy

This folder contains a local copy of [SheetJS](https://sheetjs.com/) (v0.20.3) for reading and writing Excel files when the CDN is unavailable.

The app loads Excel support in this order:

1. **xlsx-js-style** (`vendor/xlsx-js-style/`) — read/write with cell colours (primary)
2. SheetJS CDN — read-only fallback when online
3. Local SheetJS (`vendor/xlsx/xlsx.mjs`) — read-only offline fallback

If both fail, the dashboard shows a friendly message and the **Try sample timetable** button still works using built-in sample data.

To refresh this file:

```bash
curl -L "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" -o vendor/xlsx/xlsx.mjs
```

Include this folder in your GitHub repository so GitHub Pages works offline.
