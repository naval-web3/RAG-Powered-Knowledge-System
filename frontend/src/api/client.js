import axios from "axios";

// All calls go through the Vite proxy to the FastAPI backend at /api.
// The 120s timeout is a safety net: the backend caps generation at LLM_TIMEOUT
// (90s) and returns a friendly message, so this only fires if the whole request
// stalls. Without it, axios waits forever and the chat "keeps thinking".
const client = axios.create({ baseURL: "/", timeout: 120000 });

// Attach JWT from localStorage on every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the session and bounce to login.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    // Give client-side timeouts a readable message instead of a bare
    // "timeout of 120000ms exceeded" that leaks into the chat UI.
    if (err.code === "ECONNABORTED" && !err.response) {
      err.friendlyMessage =
        "The request took too long and was cancelled. The selected model may be too slow — try a smaller, faster model.";
    }
    return Promise.reject(err);
  }
);

export default client;
