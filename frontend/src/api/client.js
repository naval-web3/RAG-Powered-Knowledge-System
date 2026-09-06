import axios from "axios";

// All calls go through the Vite proxy to the FastAPI backend at /api.
// The 300s timeout is a safety net: the backend caps generation at LLM_TIMEOUT
// and returns a friendly message first, so this only fires if the whole request
// stalls. It's generous because large local models (8B) offloaded to CPU on a
// 4 GB GPU can take a couple of minutes per answer.
const client = axios.create({ baseURL: "/", timeout: 300000 });

// The access token now lasts an hour rather than a day, so an open tab meets an
// expired token routinely instead of never. Nothing about that should be
// visible: the 401 below buys a new token with the refresh token and replays
// the request that failed. What the user sees is a request that took slightly
// longer, and only once an hour.

const TOKEN_KEY = "token";
const REFRESH_KEY = "refresh_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("user");
}

function toLogin() {
  clearSession();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

// One refresh at a time. Several requests can fail together, and each rotation
// spends the token it was given, so letting them all refresh at once would have
// the second one present a token the first had already spent. The server reads
// that as a stolen token and ends every session, which is the correct reading of
// it and exactly what we must not provoke ourselves.
let inFlight = null;

export function refreshAccessToken() {
  if (inFlight) return inFlight;

  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve(null);

  // Bare axios, not `client`: a refresh that 401s must not re-enter the
  // interceptor that called it.
  inFlight = axios
    .post("/api/auth/refresh", { refresh_token: refreshToken })
    .then(({ data }) => {
      storeSession(data);
      return data.access_token;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// Attach JWT from localStorage on every request.
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Paths where a 401 is the answer rather than a problem to work around: a wrong
// password, or a refresh token the server has already withdrawn.
const NO_RETRY = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"];

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response && err.response.status === 401 && original) {
      const exempt = NO_RETRY.some((p) => (original.url || "").startsWith(p));
      if (!exempt && !original._retried) {
        original._retried = true;
        const fresh = await refreshAccessToken();
        if (fresh) {
          original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
          return client(original);
        }
      }
      // No refresh token, or the refresh was refused: the session is over. A
      // 401 from login itself is a wrong password, and the login screen is
      // already where the user is standing.
      if (!exempt) {
        toLogin();
      }
    }

    // Give client-side timeouts a readable message instead of a bare
    // "timeout of 120000ms exceeded" that leaks into the chat UI.
    if (err.code === "ECONNABORTED" && !err.response) {
      err.friendlyMessage =
        "That took too long, so we stopped waiting. The model you picked may be too slow for this machine. Try a smaller one.";
    }
    return Promise.reject(err);
  }
);

export default client;
