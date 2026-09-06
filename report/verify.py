"""
Check the report's internal references against what the report actually contains.

Every "§4.2", "Figure 3.7" and "Table 5.1" in the prose is a promise that the
thing exists. A renumbering breaks those silently: the sentence still reads
correctly and points at nothing, or, worse, at something else that happens to
have taken the number. This walks the sources the way build.py does, works out
what number each heading, figure and table will be given, and then checks every
reference in the prose against that.

    python verify.py

It mirrors build.py's rules rather than parsing the .docx, so it can be run
before a build and will say what a build would produce.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")

# Numbering is a state, not a per-file flag: this comment turns it on and it
# stays on for every file after it. The front matter comes before it.
NUMBERED_ON = "<!-- numbered -->"


def read_sources():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".md"))
    return [(name, open(os.path.join(SRC, name), encoding="utf-8").read()) for name in files]


def build_index(sources):
    """The numbers the built document will carry."""
    sections, figures, tables = set(), set(), set()
    chapter = section = subsection = fig = tab = 0
    numbering = False

    for _name, text in sources:
        for line in text.splitlines():
            if line.strip() == NUMBERED_ON:
                numbering = True
                continue

            if line.startswith("# "):
                title = line[2:].strip()
                section = subsection = 0
                if numbering and not title.startswith("*"):
                    chapter += 1
                    fig = tab = 0

            elif line.startswith("## "):
                title = line[3:].strip()
                section += 1
                subsection = 0
                if numbering and not title.startswith("*"):
                    sections.add("%d.%d" % (chapter, section))

            elif line.startswith("### "):
                title = line[4:].strip()
                subsection += 1
                if numbering and not title.startswith("*"):
                    sections.add("%d.%d.%d" % (chapter, section, subsection))

            elif line.startswith("!["):
                fig += 1
                figures.add("%d.%d" % (chapter, fig))

            elif line.startswith("Table: "):
                tab += 1
                tables.add("%d.%d" % (chapter, tab))

    return sections, figures, tables, chapter


def main() -> int:
    sources = read_sources()
    sections, figures, tables, chapters = build_index(sources)

    problems = []
    for name, text in sources:
        for number in re.findall(r"§(\d+(?:\.\d+)*)", text):
            if "." not in number:
                if not 1 <= int(number) <= chapters:
                    problems.append("%s: section %s names no chapter" % (name, number))
            elif number not in sections:
                problems.append("%s: section %s does not exist" % (name, number))
        for number in re.findall(r"Figure (\d+\.\d+)", text):
            if number not in figures:
                problems.append("%s: Figure %s does not exist" % (name, number))
        for number in re.findall(r"Table (\d+\.\d+)", text):
            if number not in tables:
                problems.append("%s: Table %s does not exist" % (name, number))
        for path in re.findall(r"\]\((\.\./)?(assets/[^)]+?\.png)\)", text):
            full = os.path.join(HERE, path[1])
            if not os.path.exists(full):
                problems.append("%s: missing image %s" % (name, path[1]))

    print("%d chapters, %d sections, %d figures, %d tables"
          % (chapters, len(sections), len(figures), len(tables)))

    if problems:
        print("\n%d problem(s):" % len(problems))
        for problem in problems:
            print("  " + problem)
        return 1

    print("Every reference resolves.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
