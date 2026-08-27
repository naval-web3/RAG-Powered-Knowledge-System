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
import ForgotPassword from "../src/pages/ForgotPassword";
import Landing from "../src/pages/Landing";
import Login from "../src/pages/Login";
import ProjectPage from "../src/pages/ProjectPage";
import Register from "../src/pages/Register";
import Settings from "../src/pages/Settings";

// Pages that need the chat providers, mounted at a route they read params from.
const INSIDE_APP = [
  ["ChatPage", "/", <ChatPage />, "/"],
  ["DocumentsPage", "/documents", <DocumentsPage />, "/documents"],
  ["Settings", "/settings", <Settings />, "/settings"],
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
        <AuthProvider>{element}</AuthProvider>
      </MemoryRouter>
    )
  );
}

console.log("rendering pages inside the provider tree:");
for (const [name, path, element, at] of INSIDE_APP) {
  check(name, () =>
    renderToString(
      <MemoryRouter initialEntries={[at]}>
        <AuthProvider>
          <ToastProvider>
            <ChatProvider>
              <Routes>
                <Route path={path} element={element} />
              </Routes>
            </ChatProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    )
  );
}

console.log("rendering the app shell:");
for (const [name, at] of SHELL) {
  check(name, () =>
    renderToString(
      <MemoryRouter initialEntries={[at]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ChatPage />} />
              <Route path="projects/:projectId" element={<ProjectPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    )
  );
}

if (failed) {
  console.log(`\n${failed} page(s) failed to render.`);
  process.exit(1);
}
console.log("\nevery page rendered.");
