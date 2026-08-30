/**
 * MarkdownLite — a tiny, dependency-free renderer for the small subset of
 * Markdown the assistant produces: paragraphs, bullet lists (-, *, •),
 * numbered lists, **bold**, `inline code`, and single-newline line breaks.
 *
 * Lists may nest. Indentation decides depth, and a list that has sub-points
 * numbers its top level so the two tiers read as different things; the points
 * underneath stay as dots. A flat list with no sub-points is left alone.
 */

// CommonMark allows -, * and + as bullet markers; the model uses + for its
// sub-items, and omitting it left those lines rendering as literal text.
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;

// Faintest last: the newest characters are the least settled.
const FADE = [0.85, 0.65, 0.45, 0.25];

/** Split a trailing run into steps of rising transparency. */
function fadeTail(text, budget, keyPrefix) {
  const per = Math.ceil(budget / FADE.length);
  const cut = Math.max(0, text.length - per * FADE.length);
  const nodes = [];
  if (cut > 0) nodes.push(<span key={`${keyPrefix}-h`}>{text.slice(0, cut)}</span>);
  let at = cut;
  FADE.forEach((o, k) => {
    const piece = text.slice(at, at + per);
    if (piece) nodes.push(<span key={`${keyPrefix}-f${k}`} style={{ opacity: o }}>{piece}</span>);
    at += per;
  });
  return nodes;
}

/* Drop a bold or code marker the model has opened but not closed yet, so it
   does not sit on screen as literal punctuation while its partner is still
   on the way. */
function dropDangling(s) {
  let out = s;
  const bold = out.match(/\*\*/g);
  if (bold && bold.length % 2 === 1) {
    const at = out.lastIndexOf("**");
    out = out.slice(0, at) + out.slice(at + 2);
  }
  const ticks = out.match(/`/g);
  if (ticks && ticks.length % 2 === 1) {
    const at = out.lastIndexOf("`");
    out = out.slice(0, at) + out.slice(at + 1);
  }
  return out;
}

function renderInline(text, keyPrefix, fade = 0) {
  // Split on **bold** and `code`, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={key}>{p.slice(1, -1)}</code>;
    // Only the final plain run carries the fade; a trailing bold or code span
    // is short-lived and left alone rather than split apart.
    if (fade > 0 && i === parts.length - 1) return <span key={key}>{fadeTail(p, fade, key)}</span>;
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

function renderList(nodes, keyPrefix, depth, fade = 0) {
  const anyOrdered = nodes.some((n) => n.ordered);
  // Top tier takes numbers when it has sub-points, so the levels are told
  // apart by marker and not only by indent. Deeper tiers keep dots unless the
  // model actually wrote them as a numbered list.
  const hasChildren = nodes.some((n) => n.children.length > 0);
  const ordered = depth === 0 ? anyOrdered || hasChildren : anyOrdered;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={keyPrefix}>
      {nodes.map((n, i) => {
        // The tail lives in the last item, and inside its deepest last child.
        const tail = fade > 0 && i === nodes.length - 1 ? fade : 0;
        return (
          <li key={i}>
            {renderInline(n.text, `${keyPrefix}-${i}`, n.children.length ? 0 : tail)}
            {n.children.length > 0 &&
              renderList(n.children, `${keyPrefix}-${i}`, depth + 1, tail)}
          </li>
        );
      })}
    </Tag>
  );
}

export default function MarkdownLite({ text, fadeTail: fadeBudget = 0 }) {
  const source = String(text || "").replace(/\r/g, "");
  const lines = (fadeBudget > 0 ? dropDangling(source) : source).split("\n");
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
    const heading = line.match(HEADING);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      continue;
    }
    if (RULE.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }
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
        const lastBlock = i === blocks.length - 1;
        const tail = lastBlock ? fadeBudget : 0;
        if (b.kind === "list") return renderList(b.nodes, String(i), 0, tail);
        if (b.kind === "hr") return <hr key={i} />;
        if (b.kind === "h") {
          // Capped at h4: these are rendered inside a dialog, and an h1 sized
          // for a page would shout across it.
          const Tag = `h${Math.min(4, b.level + 1)}`;
          return <Tag key={i}>{renderInline(b.text, String(i), tail)}</Tag>;
        }
        return (
          <p key={i}>
            {b.lines.map((ln, j) => (
              <span key={j}>
                {renderInline(ln, `${i}-${j}`, j === b.lines.length - 1 ? tail : 0)}
                {j < b.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}
