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
import ForgotPassword from "../src/pages/ForgotPassword";
import Landing from "../src/pages/Landing";
import Login from "../src/pages/Login";
import ProjectPage from "../src/pages/ProjectPage";
import Register from "../src/pages/Register";
import DocumentDialog from "../src/components/DocumentDialog";
import LanguageDialog from "../src/components/LanguageDialog";
import SettingsDialog, { SECTIONS } from "../src/components/SettingsDialog";
import { LocaleProvider } from "../src/i18n";
import { LANGUAGES } from "../src/i18n/languages";
import STRINGS from "../src/i18n/strings";

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
];

// Standalone pages: no chat context needed.
const STANDALONE = [
  ["Landing", <Landing />],
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
    for (const key of ["nav.account", "settings.profile", "settings.chatFont"]) {
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
