# BlockTrack — final implementation report

The final report is built from the implemented system, not the original synopsis. It
reflects the no-backend architecture, local Anvil demo, encrypted order envelopes,
status-only public tracking, current Sepolia status, test evidence and updated team
ownership.

## Files

- `BlockTrack-Final-Report.pdf` — the deliverable (38 pages including the cover).
- `BlockTrack-Final-Report.html` — styled HTML with the printed table-of-contents page
  numbers.
- `report.html` — editable source template (TOC page numbers are placeholders).
- `cover.html` — full-bleed A4 cover.
- `report.css` — print stylesheet and local IBM Plex fonts.
- `assets/fonts/` — self-hosted report fonts.

## Rebuild

```bash
npm run report
```

Requirements: Node/Playwright (Chrome), Python 3 and PyMuPDF. The script renders the
cover and body with Chrome, maps section headings to printed page numbers, renders the
final body with running header/footer, then merges the cover and adds the PDF outline and
metadata. Build intermediates go to `docs/report/.build/` (ignored by git).

## Page structure

Cover (unnumbered) → Contents (body page 1) → 19 sections → 4 appendices. The cover is
not part of the printed page numbering; the TOC and footer numbers refer to the body.
