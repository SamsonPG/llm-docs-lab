# Brand mark

`logo.svg` — open folio + citation node (docs that point to evidence).  
`logo.png` — app-icon rendering of the same mark for social / store use.

The live Worker page embeds an SVG `data:` favicon and the same paths in the nav mark
(`src/ui.mjs`) so CSP stays closed — no third-party image fetch.
