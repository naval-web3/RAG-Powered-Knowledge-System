# Project report — structure and status

Target: **100–125 pages excluding code listings**, per MCSP-232 guidelines VI.2.
Sources live in `src/`, one file per chapter, built by `build.py` into `report.docx`
and exported to `report.pdf` by `export-pdf.ps1`.

Every heading below maps to a component the guidelines list as carrying weight in
the evaluation. Nothing in that list is absent.

| # | File | Chapter | Guideline component | Target pp | Status |
|---|------|---------|---------------------|-----------|--------|
| 00 | `00-front-matter.md` | Title, Certificate of Originality, Acknowledgement, Abstract, Contents, List of Figures, List of Tables | VI.1(iii), VI.2 index | 9 | done |
| 01 | `01-introduction.md` | Introduction and Objectives | Introduction/Objectives | 10 | done |
| 02 | `02-system-analysis.md` | System Analysis | Identification of need · feasibility · planning (PERT + Gantt) · SRS · paradigm · DFD 0/1/2 · ER · data dictionary · UML | 32 | done |
| 03 | `03-system-design.md` | System Design | Modularisation · integrity and constraints · database design · procedural design · UI design · architecture | 18 | to do |
| 04 | `04-coding.md` | Coding | SQL/DDL · access rights · code segments with comments · standardisation · efficiency · error handling · parameter passing · validation | 12 | to do |
| 05 | `05-testing.md` | Testing | Techniques and strategies · test plan · unit test report · system test report · debugging and code improvement | 11 | to do |
| 06 | `06-security.md` | System Security Measures | Database/data security · user profiles and access rights | 7 | to do |
| 07 | `07-reports.md` | Reports and Outputs | Sample report layouts | 5 | to do |
| 08 | `08-screens.md` | Screen Layouts | Screen dumps in order | 12 | to do |
| 09 | `09-future-scope.md` | Future Scope and Further Enhancement | Future scope | 4 | to do |
| 10 | `10-conclusion.md` | Conclusion | — | 2 | to do |
| 11 | `11-bibliography.md` | Bibliography | Bibliography | 2 | to do |
| 12 | `12-appendices.md` | Appendices: installation, user manual, REST API reference, test corpus | Appendices | 8 | to do |
| 13 | `13-glossary.md` | Glossary | Glossary | 3 | to do |

**Where the pages go.** Chapter 2 came out at 32 pages rather than the 26 first
planned, and thirteen of those are full-page landscape plates: the diagrams are
only legible at about 9 inches wide, which was established by building a page
and looking at it rather than by guessing. The remaining chapters were re-cut to
land the whole report near 135 pages including every plate.

## Rules this report is written to

- **Nothing generic.** The guidelines say theory available in reference books
  should be avoided; every section describes what *this* system does.
- **Every claim is checkable.** Timings come from `docs/test-results.md`, screens
  from `docs/screenshots/`, code excerpts from the tracked source at the commit
  the report is built from.
- **The approved synopsis is the contract.** Title, objectives and module names
  match it. Where the delivered system goes beyond it (OCR, eleven interface
  languages, projects), that is stated as such in §1.5 rather than quietly folded in.
- Figures are numbered per chapter and titled; tables likewise. Both lists are
  generated with page numbers.

## Building

```
cd report
..\backend\.venv\Scripts\python.exe build.py
powershell -ExecutionPolicy Bypass -File export-pdf.ps1
```

`export-pdf.ps1` drives Word twice so the contents, list of figures and list of
tables settle on the right page numbers, then reports the final page count.
