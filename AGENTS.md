## Architecture
- Trame computes drilling distributions only (by number of intervals, fixed pitch, maximum pitch). The former hidden modules (reinforced zone, obstacle, panels, expansion) and PDF/DXF exports were removed on purpose; results are shown on screen and copied.
- All calculations live in src/lib/trame-calc.ts (pure code, tested in trame-calc.test.ts); the UI in src/routes/index.tsx only displays them.
- Vocabulary: the distance between the edge and the first/last hole is always "distance au bord" (début / fin), never "rive", "marge" or "pince".
- With whole millimetres, an odd remainder is never split by rounding both sides: the start is rounded down and the end takes the rest, so start + intervals + end always equals the total length.
- Data (history) stays in localStorage only, no backend.
