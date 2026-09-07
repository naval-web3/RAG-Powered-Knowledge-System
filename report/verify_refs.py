"""
Print what every section cross-reference actually points at.

verify.py proves a reference is not dangling. That is a weaker claim than it
looks: §2.6 and §2.7 both exist, so citing the data flow diagrams when you meant
the schema passes every automated check and is still wrong. This resolves each
reference to the title of the section it lands on, so the two can be compared by
eye. Nothing here can be decided automatically; the point is to make the
judgement cheap instead of impossible.

    python verify_refs.py [--src DIR] [--filter WORD]
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = (os.path.abspath(sys.argv[sys.argv.index("--src") + 1])
       if "--src" in sys.argv else os.path.join(HERE, "src"))
ONLY = (sys.argv[sys.argv.index("--filter") + 1].lower()
        if "--filter" in sys.argv else None)

NUMBERED_ON = "<!-- numbered -->"


def titles():
    """Map every section number to its heading text, the way build.py numbers them."""
    out = {}
    chapter = section = subsection = 0
    numbering = False
    for name in sorted(f for f in os.listdir(SRC) if f.endswith(".md")):
        text = open(os.path.join(SRC, name), encoding="utf-8").read()
        fenced = False
        for line in text.splitlines():
            if line.startswith("```"):
                fenced = not fenced
                continue
            if fenced:
                continue
            if line.strip() == NUMBERED_ON:
                numbering = True
            elif line.startswith("# "):
                section = subsection = 0
                if numbering and not line[2:].strip().startswith("*"):
                    chapter += 1
                    out["%d" % chapter] = line[2:].strip()
            elif line.startswith("## "):
                section += 1
                subsection = 0
                if numbering and not line[3:].strip().startswith("*"):
                    out["%d.%d" % (chapter, section)] = line[3:].strip()
            elif line.startswith("### "):
                subsection += 1
                if numbering and not line[4:].strip().startswith("*"):
                    out["%d.%d.%d" % (chapter, section, subsection)] = line[4:].strip()
    return out


def main() -> int:
    index = titles()
    print("%d numbered headings\n" % len(index))
    shown = 0
    for name in sorted(f for f in os.listdir(SRC) if f.endswith(".md")):
        text = open(os.path.join(SRC, name), encoding="utf-8").read()
        rows = []
        for match in re.finditer(r"(?:§|[Ss]ection )(\d+(?:\.\d+)*)", text):
            number = match.group(1)
            start = max(0, match.start() - 60)
            context = re.sub(r"\s+", " ", text[start:match.end() + 30]).strip()
            if ONLY and ONLY not in context.lower():
                continue
            rows.append((number, index.get(number, "!! NO SUCH SECTION"), context))
        if rows:
            print("--- %s" % name)
            for number, title, context in rows:
                print("  %-8s -> %-46s  ...%s..." % (number, title[:46], context[-70:]))
                shown += 1
            print()
    print("%d reference(s) listed" % shown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
