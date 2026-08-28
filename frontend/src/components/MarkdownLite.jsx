/**
 * MarkdownLite — a tiny, dependency-free renderer for the small subset of
 * Markdown the assistant produces: paragraphs, bullet lists (-, *, •),
 * numbered lists, **bold**, `inline code`, and single-newline line breaks.
 *
 * Lists may nest. Indentation decides depth, and a list that has sub-points
 * numbers its top level so the two tiers read as different things; the points
 * underneath stay as dots. A flat list with no sub-points is left alone.
 */

const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;

function renderInline(text, keyPrefix) {
  // Split on **bold** and `code`, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={key}>{p.slice(1, -1)}</code>;
    return <span key={key}>{p}</span>;
  });
}

/** Flat, indent-tagged items -> a tree, by walking a stack of open levels. */
function buildTree(flat) {
  const root = [];
  const stack = [{ indent: -1, children: root }];
  for (const item of flat) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
    const node = { text: item.text, ordered: item.ordered, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push({ indent: item.indent, children: node.children });
  }
  return root;
}

function renderList(nodes, keyPrefix, depth) {
  const anyOrdered = nodes.some((n) => n.ordered);
  // Top tier takes numbers when it has sub-points, so the levels are told
  // apart by marker and not only by indent. Deeper tiers keep dots unless the
  // model actually wrote them as a numbered list.
  const hasChildren = nodes.some((n) => n.children.length > 0);
  const ordered = depth === 0 ? anyOrdered || hasChildren : anyOrdered;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={keyPrefix}>
      {nodes.map((n, i) => (
        <li key={i}>
          {renderInline(n.text, `${keyPrefix}-${i}`)}
          {n.children.length > 0 && renderList(n.children, `${keyPrefix}-${i}`, depth + 1)}
        </li>
      ))}
    </Tag>
  );
}

export default function MarkdownLite({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let para = [];
  let list = null; // flat items, tagged with indent, assembled on flush

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", lines: para });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: "list", nodes: buildTree(list) });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    const hit = bullet || numbered;
    if (hit) {
      flushPara();
      if (!list) list = [];
      // Tabs count as two spaces so mixed indentation still nests predictably.
      list.push({
        indent: hit[1].replace(/\t/g, "  ").length,
        text: hit[2],
        ordered: Boolean(numbered),
      });
    } else if (line.trim() === "") {
      // Blank lines inside a list make it "loose" in Markdown; they do not end
      // it. Ending it here was what split one answer into several <ol>s, each
      // restarting its numbering at 1. Only prose below, or the end of the
      // input, closes a list.
      flushPara();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "list") return renderList(b.nodes, String(i), 0);
        return (
          <p key={i}>
            {b.lines.map((ln, j) => (
              <span key={j}>{renderInline(ln, `${i}-${j}`)}{j < b.lines.length - 1 && <br />}</span>
            ))}
          </p>
        );
      })}
    </>
  );
}
