## Architecture
- Trame computes drilling distributions only (by number of intervals, fixed pitch, maximum pitch). The former hidden modules (reinforced zone, obstacle, panels, expansion) and PDF/DXF exports were removed on purpose; results are shown on screen and copied.
- All calculations live in src/lib/trame-calc.ts (pure code, tested in trame-calc.test.ts); the UI in src/routes/index.tsx only displays them.
- Vocabulary: the distance between the edge and the first/last hole is always "distance au bord" (début / fin), never "rive", "marge" or "pince".
- With whole millimetres, an odd remainder is never split by rounding both sides: the start is rounded down and the end takes the rest, so start + intervals + end always equals the total length.
- Data (history) stays in localStorage only, no backend.
- Every mode shows the same view (src/components/trame/ResultsView.tsx): a compact clickable table of options (no positions column) and a detail panel for the selected one (bar schema, cumulative positions, copy). Modes are normalised to DrillOption in trame-calc.ts; a "mm ronds" badge flags options whose pitch and start distance are whole millimetres.
- Visual identity shared with Linear and Format: uppercase letter-spaced section titles, tabular (non-mono) numbers in fields, the same discreet footer signature and About dialog (src/lib/version.ts is the single source for name/version/author). Trame keeps its own accent: copper (--color-trame in styles.css, lighter in .dark).
