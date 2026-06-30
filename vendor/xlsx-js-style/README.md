# xlsx-js-style — offline copy

Styled Excel export (fills, fonts, borders) for the Assessment Operations Dashboard.

Based on [xlsx-js-style](https://www.npmjs.com/package/xlsx-js-style) v1.2.0 (SheetJS 0.18.5 + community styling).

The browser loads `xlsx.min.js` via a script tag in `index.html`. Node scripts use `node.mjs`.

To refresh:

```bash
curl -L "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.min.js" -o vendor/xlsx-js-style/xlsx.min.js
curl -L "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/cpexcel.js" -o vendor/xlsx-js-style/cpexcel.js
```

Plain SheetJS (`vendor/xlsx/`) remains as a read-only fallback when the styled bundle fails to load.
