/**
 * The smallest browser surface the app touches at module scope, so the smoke
 * test can render in node. Imported first by render-smoke.jsx: the app reads
 * window.matchMedia and localStorage while its modules are still evaluating,
 * long before React renders anything.
 */
const store = new Map();

const noopElement = {
  setAttribute() {},
  getAttribute() {
    return null;
  },
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  style: {},
  addEventListener() {},
  removeEventListener() {},
  contains: () => false,
  focus() {},
  click() {},
};

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

globalThis.document = {
  documentElement: noopElement,
  body: noopElement,
  createElement: () => ({ ...noopElement }),
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {},
  removeEventListener() {},
};

globalThis.window = {
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
  location: { pathname: "/", href: "http://localhost:5173/", origin: "http://localhost:5173" },
  localStorage: globalThis.localStorage,
  document: globalThis.document,
  addEventListener() {},
  removeEventListener() {},
  // Absent on purpose: the app must cope with a browser that has no speech
  // recognition, and this is the case that proves it does.
  SpeechRecognition: undefined,
  webkitSpeechRecognition: undefined,
};

globalThis.navigator = { userAgent: "node", clipboard: { writeText: async () => {} } };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.performance = globalThis.performance || { now: () => 0 };
