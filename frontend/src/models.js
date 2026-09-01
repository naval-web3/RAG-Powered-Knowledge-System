/**
 * Turning what Ollama reports into something worth reading.
 *
 * Ollama names a model `family+version:size` — `llama3.2:3b`. Listing those raw
 * puts near-identical rows next to each other and asks the reader to spot the
 * difference in a version number. So the family is shown once and everything
 * that varies underneath it becomes a level: one "Llama" offering 3B and 8B,
 * rather than two Llamas.
 *
 * Nothing here is a lookup of what is installed — the list comes from
 * /api/models, live — so a model pulled tomorrow parses on the same rules and
 * appears without anyone editing this file. PRETTY only fixes the capitals on
 * families whose own spelling is not a plain word.
 */

const PRETTY = {
  llama: "Llama",
  codellama: "Code Llama",
  tinyllama: "TinyLlama",
  mistral: "Mistral",
  mixtral: "Mixtral",
  qwen: "Qwen",
  qwq: "QwQ",
  gemma: "Gemma",
  phi: "Phi",
  deepseek: "DeepSeek",
  "deepseek-r1": "DeepSeek-R1",
  "deepseek-coder": "DeepSeek Coder",
  "gpt-oss": "GPT-OSS",
  starcoder: "StarCoder",
  nomic: "Nomic",
  granite: "Granite",
  olmo: "OLMo",
  smollm: "SmolLM",
};

/** `8x7b` counts as 56B for the purpose of "will this be slow". */
const SIZE_RE = /(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?\s*b\b/i;

function titleCase(s) {
  return s
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join("-");
}

/* OpenAI's own names are the names people know them by, so they are corrected
   rather than rewritten: gpt-4o is "GPT-4o", not "Gpt 4o". */
function prettyOpenAI(id) {
  return id
    .replace(/^gpt/i, "GPT")
    .replace(/^o(\d)/i, "o$1")
    .replace(/-turbo/i, " Turbo")
    .replace(/-preview/i, " Preview")
    .replace(/-mini/i, " mini");
}

/**
 * One model id, taken apart.
 * `llama3.2:3b` → family "llama", version "3.2", size "3B", params 3
 */
export function parseModel(provider, id) {
  if (provider !== "ollama") {
    const label = prettyOpenAI(id);
    return { provider, id, family: id, familyLabel: label, version: "", size: "", params: null };
  }

  const [repoRaw, tagRaw = ""] = id.split(":");
  const repo = (repoRaw || id).split("/").pop().toLowerCase();

  /* The version is the digits the family name trails off into — `llama3.2` is
     llama at 3.2 — and it is optional, because plenty of models have none.
     Two things stop that from over-reading: a name PRETTY already knows is
     taken whole, so `deepseek-r1` does not become deepseek-r at version 1; and
     a split that would leave a lone letter behind is refused for the same
     reason, for the compounds PRETTY has not heard of yet. */
  let family = repo;
  let version = "";
  if (!PRETTY[repo]) {
    const m = repo.match(/^(.*?)[-_.]?(\d[\d.]*)$/);
    if (m && !/(^|[-_.])[a-z]$/.test(m[1])) {
      family = m[1].replace(/[-_.]+$/, "");
      version = m[2];
    }
  }

  const s = tagRaw.match(SIZE_RE);
  const size = s ? `${s[1]}${s[2] ? `x${s[2]}` : ""}B` : "";
  const params = s ? (s[2] ? parseFloat(s[1]) * parseFloat(s[2]) : parseFloat(s[1])) : null;

  return {
    provider,
    id,
    family,
    familyLabel: PRETTY[family] || titleCase(family) || id,
    version,
    size,
    tag: tagRaw,
    params,
  };
}

/* Big models are the ones that crawl on a 4GB card. The threshold is the one
   the composer already used before any of this existed. */
export const SLOW_PARAM_B = 5;
export const isSlow = (m) => (m.params == null ? false : m.params >= SLOW_PARAM_B);

/**
 * Every model, gathered into families and ordered smallest first.
 *
 * A level needs to say which model it is without repeating the family, so it is
 * normally just the size — "3B". Two models of the SAME size in one family can
 * only be told apart by their version, so in that case the version comes back:
 * "3.1 · 8B". Working this out per family rather than always printing both is
 * what keeps the common case short.
 */
export function groupModels(models) {
  const all = [
    ...(models.ollama || []).map((id) => parseModel("ollama", id)),
    ...(models.openai || []).map((id) => parseModel("openai", id)),
  ];

  const byFamily = new Map();
  for (const m of all) {
    const key = `${m.provider}|${m.family}`;
    if (!byFamily.has(key)) {
      byFamily.set(key, { key, provider: m.provider, family: m.family, label: m.familyLabel, levels: [] });
    }
    byFamily.get(key).levels.push(m);
  }

  const groups = [...byFamily.values()];
  for (const g of groups) {
    g.levels.sort((a, b) => (a.params ?? 0) - (b.params ?? 0) || a.id.localeCompare(b.id));
    /* The size if there is one, else whatever the tag calls itself -- `mini`
       says more than the `3` in phi3 does. "latest" is nobody's idea of a
       level, so it only stands in when there is nothing else at all. */
    const base = (l) =>
      l.size || (l.tag && l.tag !== "latest" ? l.tag : "") || l.version || l.tag || l.id;
    const bases = g.levels.map(base);
    const unique = new Set(bases).size === bases.length;
    for (const l of g.levels) {
      l.levelLabel = unique ? base(l) : [l.version, base(l)].filter(Boolean).join(" · ");
    }
    // What the family is worth as a whole, for the fast/slow line under its name.
    g.params = g.levels.reduce((n, l) => Math.max(n, l.params ?? 0), 0);
  }

  /* Local first: this app's whole point is that it answers off your own
     machine, and the cloud is the alternative rather than the default. */
  groups.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider === "ollama" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return groups;
}

/** The `provider|model` string the rest of the app selects with. */
export const selOf = (m) => `${m.provider}|${m.id}`;

/** Find the group and level a selection points at, if it is still installed. */
export function locate(groups, sel) {
  for (const g of groups) {
    const level = g.levels.find((l) => selOf(l) === sel);
    if (level) return { group: g, level };
  }
  return { group: null, level: null };
}
