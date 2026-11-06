# OCR Log

PDFs in `agent/resource/` that have already been converted to JSON. One row per PDF.

Status values:
- `awaiting review`: JSON is in `agent/output/`, not yet checked by a person.
- `published`: reviewed and copied into `site/`.

| PDF | OCR date | Output | Problems | Images | Answer key | Status |
|---|---|---|---|---|---|---|
| alevel-physics-2568.pdf | 2026-11-06 | alevel-physics-2568.json | 30 | 9 | Inside PDF (page 23) | published |
| alevel-math1-2568.pdf | 2026-11-06 | alevel-math1-2568.json | 30 | 2 | Inside PDF (page 21) | published |
| alevel-math1-2566.pdf (source file: ALevel16603.pdf, not copied into agent/resource) | 2026-11-06 | alevel-math1-2566.json | 30 | 8 | Inside PDF (page 14) | awaiting review |
| alevel-math1-2567.pdf (source file: ALevel16703.pdf, not copied into agent/resource) | 2026-11-06 | alevel-math1-2567.json | 30 | 2 | Inside PDF (page 11) | awaiting review |
| alevel-math1-2569.pdf (source file: ALevel16903.pdf, not copied into agent/resource) | 2026-11-06 | alevel-math1-2569.json | 30 | 4 | Inside PDF (page 12) | awaiting review |
