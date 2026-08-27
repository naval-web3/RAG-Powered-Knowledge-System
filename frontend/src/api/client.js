import axios from "axios";

// All calls go through the Vite proxy to the FastAPI backend at /api.
// The 300s timeout is a safety net: the backend caps generation at LLM_TIMEOUT
// and returns a friendly message first, so this only fires if the whole request
// stalls. It's generous because large local models (8B) offloaded to CPU on a
// 4 GB GPU can take a couple of minutes per answer.
const client = axios.create({ baseURL: "/", timeout: 300000 });

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
        "That took too long, so we stopped waiting. The model you picked may be too slow for this machine. Try a smaller one.";
    }
    return Promise.reject(err);
  }
);

export default client;
