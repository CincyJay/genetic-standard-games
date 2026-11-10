# Art

Vector illustrations for the garden game, drawn in code.

- `src/entrance.py`: Entrance Path scene, overgrown and restored (each object is a separate SVG group)
- `src/marisol.py`: Marisol Vega portrait in three expressions (deadpan, smirk, surprised)
- `render.mjs`: renders every `out/*.svg` to a transparent PNG for review

```bash
python3 art/src/entrance.py && python3 art/src/marisol.py && node art/render.mjs
```
