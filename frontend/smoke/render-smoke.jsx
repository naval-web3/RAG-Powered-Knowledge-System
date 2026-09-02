/**
 * Server-render the real provider + page tree in node.
 *
 * This exists because `npm run build` compiles a broken app happily: a hook
 * dependency array that names a `const` declared further down is valid syntax
 * and only throws at render time, which shipped a blank page. Rendering the
 * tree here evaluates every component body and every dependency array, so that
 * whole class of mistake fails the check instead of the browser.
 */
import "./dom-shim.js"; // must come first: app modules read window at load

import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Layout from "../src/components/Layout";
import { AuthProvider } from "../src/context/AuthContext";
import { ChatProvider } from "../src/context/ChatContext";
import { ToastProvider } from "../src/context/ToastContext";
import ChatPage from "../src/pages/ChatPage";
import DocumentsPage from "../src/pages/DocumentsPage";
import Features from "../src/pages/Features";
import ForgotPassword from "../src/pages/ForgotPassword";
import Landing from "../src/pages/Landing";
import Login from "../src/pages/Login";
import ProjectPage from "../src/pages/ProjectPage";
import ProjectsPage from "../src/pages/ProjectsPage";
import Register from "../src/pages/Register";
import UnderTheHood from "../src/pages/UnderTheHood";
import DocumentDialog from "../src/components/DocumentDialog";
import LanguageDialog from "../src/components/LanguageDialog";
import MarkdownLite from "../src/components/MarkdownLite";
import SettingsDialog, { SECTIONS } from "../src/components/SettingsDialog";
import { LocaleProvider } from "../src/i18n";
import { LANGUAGES } from "../src/i18n/languages";
import STRINGS from "../src/i18n/strings";
import { familyNote, groupModels, parseModel } from "../src/models";

const SAMPLE_DOC = {
  document_id: "00000000-0000-0000-0000-000000000001",
  title: "sample.pdf",
  original_filename: "sample.pdf",
  processing_status: "done",
};

// Pages that need the chat providers, mounted at a route they read params from.
const INSIDE_APP = [
  ["ChatPage", "/", <ChatPage />, "/"],
  ["DocumentDialog", "/", <DocumentDialog doc={SAMPLE_DOC} onClose={() => {}} />, "/"],
  // One entry per settings panel: they render conditionally, so rendering the
  // dialog once would only ever evaluate the first one.
  ...SECTIONS.map((s) => [
    `SettingsDialog · ${s.id}`,
    "/",
    <SettingsDialog onClose={() => {}} initialSection={s.id} />,
    "/",
  ]),
  ["LanguageDialog", "/", <LanguageDialog onClose={() => {}} />, "/"],
  ["ProjectPage", "/projects/:projectId", <ProjectPage />, "/projects/abc"],
  ["DocumentsPage", "/documents", <DocumentsPage />, "/documents"],
  ["ProjectsPage", "/projects", <ProjectsPage />, "/projects"],
];

// Standalone pages: no chat context needed.
const STANDALONE = [
  ["Landing", <Landing />],
  ["Features", <Features />],
  ["UnderTheHood", <UnderTheHood />],
  ["Login", <Login />],
  ["Register", <Register />],
  ["ForgotPassword", <ForgotPassword />],
];

// The shell brings its own providers and renders the page through an Outlet,
// so it needs its own route tree rather than the one used above. Worth its own
// case: the sidebar holds most of the app's state and none of the page checks
// mount it.
const SHELL = [
  ["Layout shell (sidebar)", "/"],
  ["Layout shell on a project route", "/projects/abc"],
];

let failed = 0;

function check(name, fn) {
  try {
    const html = fn();
    if (!html || html.length < 20) throw new Error("rendered almost nothing");
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}: ${err.message}`);
  }
}

console.log("rendering standalone pages:");
for (const [name, element] of STANDALONE) {
  check(name, () =>
    renderToString(
      <MemoryRouter>
        <LocaleProvider>
          <AuthProvider>{element}</AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    )
  );
}

console.log("rendering pages inside the provider tree:");
for (const [name, path, element, at] of INSIDE_APP) {
  check(name, () =>
    renderToString(
      <MemoryRouter initialEntries={[at]}>
        <LocaleProvider>
        <AuthProvider>
          <ToastProvider>
            <ChatProvider>
              <Routes>
                <Route path={path} element={element} />
              </Routes>
            </ChatProvider>
          </ToastProvider>
        </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    )
  );
}

// The hint is drawn from a sprite symbol by name, so a rename in one file and
// not the other would leave an empty box that still renders fine.
check("New chat hint draws its shift arrow", () => {
  const html = renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <LocaleProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ChatPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>
  );
  if (!html.includes("#i-shift")) throw new Error("no shift glyph in the sidebar");
  if (html.includes("Ctrl+Shift")) throw new Error("a plus-joined shortcut is still rendered");
  return html;
});

console.log("rendering the app shell:");
for (const [name, at] of SHELL) {
  check(name, () =>
    renderToString(
      <MemoryRouter initialEntries={[at]}>
        <LocaleProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ChatPage />} />
              <Route path="projects/:projectId" element={<ProjectPage />} />
            </Route>
          </Routes>
        </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    )
  );
}

// Every locale must carry the same keys as English. A missing one falls back
// to English at runtime, which reads as a half-translated screen rather than
// an error, so nothing would otherwise catch it.
// The renderer is shared with the chat, so a document feature added here can
// quietly change how every answer is drawn. These are the shapes a real
// document has and an answer rarely does.
console.log("checking the markdown renderer:");
{
  const md = [
    "# Plan", "### Subtitle", "", "---", "",
    "reasoning for *why* it exists, with **three separate** tracks and snake_case_names.",
    "", "| | |", "|---|---|", "| **Subject** | Faster 1600m |",
    "", "| Week | Focus |", "|---|---|", "| 1 | Base |",
    "", "Maths like 2*3*4 must not turn into italics.",
  ].join("\n");
  const h = renderToString(<MarkdownLite text={md} />);
  const cases = [
    ["headings", h.includes("<h2>") && h.includes("<h4>")],
    ["horizontal rule", h.includes("<hr")],
    ["italic", h.includes("<em>why</em>")],
    ["bold", h.includes("<strong>three separate</strong>")],
    ["two tables", (h.match(/<table>/g) || []).length === 2],
    ["an empty header row is not drawn", h.includes("<table><tbody>")],
    ["a real header row is", h.includes("<th><span>Week</span></th>")],
    ["cells render markdown", h.includes("<td><strong>Subject</strong></td>")],
    ["2*3*4 is not italic", h.includes("2*3*4")],
    ["snake_case is not italic", h.includes("snake_case_names")],
  ];
  for (const [name, ok] of cases) {
    check(name, () => {
      if (!ok) throw new Error("no");
      return "ok".repeat(12);
    });
  }
}

// Nothing in the model picker is looked up -- the family name, the level label
// and the "what is it for" line are all computed from whatever Ollama happens
// to report, so a model pulled tomorrow has to parse on these rules alone.
// Each of the first three checks below was a bug first.
//
// The last two are the ones that matter most: a note is a translation KEY, and
// a key the dictionary does not have renders as its own name -- "chat.noteQwen"
// printed on screen under a model. Nothing else in this file would catch it.
console.log("checking the model picker:");
{
  const en = STRINGS["en-US"];
  const group = (ollama, openai = []) => groupModels({ ollama, openai });
  const one = (id) => group([id])[0];
  const is = (name, got, want) =>
    check(name, () => {
      if (String(got) !== String(want)) {
        throw new Error(`got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
      }
      return "ok".repeat(12);
    });

  is("deepseek-r1:7b is not DeepSeek-R at version 1",
     parseModel("ollama", "deepseek-r1:7b").familyLabel, "DeepSeek-R1");
  is("mixtral:8x7b counts as 56B, so it reads as slow",
     parseModel("ollama", "mixtral:8x7b").params, 56);
  is("phi3:mini takes its level from the tag, not the version",
     one("phi3:mini").levels[0].levelLabel, "mini");
  is("phi4-mini is Phi, not a family of its own",
     one("phi4-mini:latest").label, "Phi");
  is("...at its mini edition, not \"latest\"",
     one("phi4-mini:latest").levels[0].levelLabel, "mini");
  is("two Phi editions stay one family, still tellable apart",
     group(["phi3:mini", "phi4-mini:latest"])[0].levels.map((l) => l.levelLabel).join(","),
     "3 \u00b7 mini,4 \u00b7 mini");
  is("an unknown -r1 compound is left whole",
     parseModel("ollama", "acme-r1-distill:8b").family, "acme-r1-distill");
  is("a name with no digits in it is left whole",
     parseModel("ollama", "nomic-embed-text:latest").family, "nomic-embed-text");
  is("the fallback note is read off the SMALLEST level",
     familyNote(one("alfa:1b")), familyNote(group(["alfa:1b", "alfa:13b"])[0]));

  /* Every family the picker can put on screen, including three invented ones
     that reach each size-derived fallback and a cloud model of each kind. */
  const reachable = group(
    ["llama3.2:3b", "qwen3.5:4b", "phi4-mini:latest", "granite4:micro", "gemma3:4b",
     "mistral:7b", "deepseek-r1:7b", "codellama:7b", "smollm2:1.7b",
     "alfa:1b", "bravo:4b", "charlie:13b"],
    ["gpt-4o", "gpt-4o-mini"],
  );
  check(`every model note is a string English has (${reachable.length} families)`, () => {
    const missing = [...new Set(reachable.map(familyNote).filter((k) => !en[k]))];
    if (missing.length) throw new Error(`not in English: ${missing.join(", ")}`);
    return "ok".repeat(12);
  });
  check("the picker's own labels are strings English has", () => {
    const missing = [
      "chat.onThisMachine", "chat.cloudSection", "chat.sizeHelp",
      "chat.modelSize", "chat.moreModels", "chat.addApiKey", "chat.slow",
    ].filter((k) => !en[k]);
    if (missing.length) throw new Error(`not in English: ${missing.join(", ")}`);
    return "ok".repeat(12);
  });
}

console.log("checking locale coverage:");
{
  const base = Object.keys(STRINGS["en-US"]).sort();
  for (const [id, dict] of Object.entries(STRINGS)) {
    check(`${id} (${base.length} keys)`, () => {
      const missing = base.filter((k) => !(k in dict));
      const extra = Object.keys(dict).filter((k) => !base.includes(k));
      if (missing.length) throw new Error(`missing ${missing.length}: ${missing.slice(0, 4).join(", ")}`);
      if (extra.length) throw new Error(`not in English: ${extra.slice(0, 4).join(", ")}`);
      const blank = base.filter((k) => !String(dict[k]).trim());
      if (blank.length) throw new Error(`empty: ${blank.slice(0, 4).join(", ")}`);
      return "ok".repeat(12);
    });
  }
}

// The row in the user menu shows `short`, so two languages sharing one would be
// indistinguishable there while looking fine in the picker.
check("language short names are present and unique", () => {
  const missing = LANGUAGES.filter((l) => !l.short || !l.short.trim());
  if (missing.length) throw new Error(`no short name: ${missing.map((l) => l.id).join(", ")}`);
  const seen = new Map();
  for (const l of LANGUAGES) {
    if (seen.has(l.short)) throw new Error(`${l.id} and ${seen.get(l.short)} both show "${l.short}"`);
    seen.set(l.short, l.id);
  }
  return "ok".repeat(12);
});

// Render the shell in a non-English locale, so the wiring is exercised and not
// just the dictionaries. Hindi shares no letters with English, which makes a
// string that failed to translate obvious.
console.log("rendering the shell in another language:");
check("SettingsDialog in Hindi", () => {
  globalThis.localStorage.setItem("retrieva-locale", "hi-IN");
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <LocaleProvider>
          <AuthProvider>
            <ToastProvider>
              <ChatProvider>
                <SettingsDialog onClose={() => {}} initialSection="general" />
              </ChatProvider>
            </ToastProvider>
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    );
    /* settings.workNone, not a role label: the options live in a popover that
       only exists while it is open, so a closed Select renders its value alone. */
    for (const key of ["nav.account", "settings.profile", "settings.chatFont",
                       "settings.work", "settings.workNone"]) {
      if (!html.includes(STRINGS["hi-IN"][key])) {
        throw new Error(`${key} did not render in Hindi`);
      }
    }
    return html;
  } finally {
    globalThis.localStorage.removeItem("retrieva-locale");
  }
});

check("Layout shell in Hindi", () => {
  globalThis.localStorage.setItem("retrieva-locale", "hi-IN");
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <LocaleProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<ChatPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>
    );
    // One string from the shell and one from the chat page, so a screen that
    // was never wired to the translator cannot hide behind one that was.
    for (const key of ["sidebar.newChat", "chat.placeholder", "chat.suggest.subjects"]) {
      if (!html.includes(STRINGS["hi-IN"][key])) {
        throw new Error(`${key} did not render in Hindi`);
      }
    }
    return html;
  } finally {
    globalThis.localStorage.removeItem("retrieva-locale");
  }
});

if (failed) {
  console.log(`\n${failed} page(s) failed to render.`);
  process.exit(1);
}
console.log("\nevery page rendered.");
