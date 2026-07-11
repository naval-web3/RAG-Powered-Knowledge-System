/**
 * MarkdownLite — a tiny, dependency-free renderer for the small subset of
 * Markdown the assistant produces: paragraphs, bullet lists (-, *, •),
 * numbered lists, **bold**, `inline code`, and single-newline line breaks.
 */

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

export default function MarkdownLite({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [] }

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", lines: para });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: list.type, items: list.items });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(numbered[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
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
        if (b.kind === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ul>;
        if (b.kind === "ol") return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `${i}-${j}`)}</li>)}</ol>;
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
