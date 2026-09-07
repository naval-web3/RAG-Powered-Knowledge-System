# Project report — structure and status

Target: **100–125 pages excluding code listings**, per MCSP-232 guidelines VI.2. The
narrative meets that; the source listings in Appendices E and F are excluded from it
and are what take the finished volume to 312 pages.
Sources live in `src/`, one file per chapter, built by `build.py` into `report.docx`
and exported to `report.pdf` by `export-pdf.ps1`.

Every heading below maps to a component the guidelines list as carrying weight in
the evaluation. Nothing in that list is absent.

| # | File | Chapter | Guideline component | Target pp | Status |
|---|------|---------|---------------------|-----------|--------|
| 00 | `00-front-matter.md` | Title, Certificate of Originality, Acknowledgement, Abstract, Contents, List of Figures, List of Tables | VI.1(iii), VI.2 index | 9 | done |
| 01 | `01-introduction.md` | Introduction and Objectives | Introduction/Objectives | 10 | done |
| 02 | `02-system-analysis.md` | System Analysis | Identification of need · feasibility · planning (PERT + Gantt) · SRS · paradigm · DFD 0/1/2 · ER · data dictionary · UML | 32 | done |
| 03 | `03-system-design.md` | System Design | Modularisation · integrity and constraints · database design · procedural design · UI design · architecture | 18 | done |
| 04 | `04-coding.md` | Coding | SQL/DDL · access rights · code segments with comments · standardisation · efficiency · error handling · parameter passing · validation | 12 | done |
| 05 | `05-testing.md` | Testing | Techniques and strategies · test plan · unit test report · system test report · debugging and code improvement | 11 | done |
| 06 | `06-security.md` | System Security Measures | Database/data security · user profiles and access rights | 7 | done |
| 07 | `07-reports.md` | Reports and Outputs | Sample report layouts | 5 | done |
| 08 | `08-screens.md` | Screen Layouts | Screen dumps in order | 12 | done |
| 09 | `09-future-scope.md` | Future Scope and Further Enhancement | Future scope | 4 | done |
| 10 | `10-conclusion.md` | Conclusion | — | 2 | done |
| 11 | `11-bibliography.md` | Bibliography | Bibliography | 2 | done |
| 12 | `12-appendices.md` | Appendices: A installation, B user manual, C REST API reference, D test corpus, E backend source, F front-end source | Appendices | 8 + 160 listings | done |
| 13 | `13-glossary.md` | Glossary | Glossary | 3 | done |

**Where the pages go.** The finished report is **312 sheets**, numbered 1 to 311
in plain arabic with the title page unnumbered. Fifty-four figures and sixty-one
tables. Sixteen sheets are full-page landscape plates: fourteen carry diagrams,
which are only legible at about nine inches wide, and two carry the unit test
case table, whose six columns do not fit a six inch text column. Both facts were
established by building a page and looking at it rather than by guessing.

About half the volume is source code. Appendix E prints the backend, thirty-four
of its thirty-nine Python files and all 6,008 of its lines, the five not printed
being empty package markers. Appendix F prints the eight front-end files that
carry the application, 3,890 of the 14,933 lines of JavaScript. The rest of the
front end, the eleven locale files and the stylesheet are on the disc only.

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

`export-pdf.ps1` drives Word so the contents, list of figures and list of tables
settle on the right page numbers, then reports the final page count.

## Checking it

Four scripts, because four different things can be wrong and none of them is
visible in the Markdown:

```
python verify.py        every section, figure and table reference resolves
python verify_pdf.py    no blank pages, no caption parted from its figure,
                        page numbering continuous
python verify_refs.py   what each reference actually points at, printed beside
                        the citing sentence, to be read
python check_fpa.py     the function point count in 2.3.2 still matches the code
```

`verify_refs.py` exists because `verify.py` proves only that a reference is not
dangling, and that is weaker than it sounds. Four references in this report cited
a section that existed and was the wrong one, and every automated check passed
on all four. Nothing can decide those but a reader; the script makes the reading
cheap.
