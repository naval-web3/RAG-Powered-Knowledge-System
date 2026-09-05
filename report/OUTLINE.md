# Project report — structure and status

Target: **100–125 pages excluding code listings**, per MCSP-232 guidelines VI.2.
Sources live in `src/`, one file per chapter, built by `build.py` into `report.docx`
and exported to `report.pdf` by `export-pdf.ps1`.

Every heading below maps to a component the guidelines list as carrying weight in
the evaluation. Nothing in that list is absent.

| # | File | Chapter | Guideline component | Target pp | Status |
|---|------|---------|---------------------|-----------|--------|
| 00 | `00-front-matter.md` | Title, Certificate of Originality, Acknowledgement, Abstract, Contents, List of Figures, List of Tables | VI.1(iii), VI.2 index | 8 | done |
| 01 | `01-introduction.md` | Introduction and Objectives | Introduction/Objectives | 10 | drafting |
| 02 | `02-system-analysis.md` | System Analysis | Identification of need · planning (PERT + Gantt) · SRS · paradigm · DFD · ER · data dictionary · UML | 26 | to do |
| 03 | `03-system-design.md` | System Design | Modularisation · integrity and constraints · database design · procedural design · UI design · architecture | 24 | to do |
| 04 | `04-coding.md` | Coding | SQL/DDL · access rights · code segments with comments · standardisation · efficiency · error handling · parameter passing · validation | 16 | to do |
| 05 | `05-testing.md` | Testing | Techniques and strategies · test plan · unit test report · system test report · debugging and code improvement | 14 | to do |
| 06 | `06-security.md` | System Security Measures | Database/data security · user profiles and access rights | 10 | to do |
| 07 | `07-reports.md` | Reports and Outputs | Sample report layouts | 8 | to do |
| 08 | `08-screens.md` | Screen Layouts | Screen dumps in order | 10 | to do |
| 09 | `09-future-scope.md` | Future Scope and Further Enhancement | Future scope | 5 | to do |
| 10 | `10-conclusion.md` | Conclusion | — | 3 | to do |
| 11 | `11-bibliography.md` | Bibliography | Bibliography | 3 | to do |
| 12 | `12-appendices.md` | Appendices: installation, user manual, REST API reference, test corpus | Appendices | 12 | to do |
| 13 | `13-glossary.md` | Glossary | Glossary | 4 | to do |

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
