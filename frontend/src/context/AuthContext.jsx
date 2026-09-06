import { createContext, useContext, useState } from "react";
import client, { clearSession, storeSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  function persist(data) {
    // Both halves of the session, and the cached user, are written together in
    // one place so a login can never leave a token without its refresh token.
    storeSession(data);
    setUser(data.user);
  }

  async function login(email, password) {
    const { data } = await client.post("/api/auth/login", { email, password });
    persist(data);
    return data.user;
  }

  async function register(username, email, password) {
    const { data } = await client.post("/api/auth/register", {
      username,
      email,
      password,
    });
    persist(data);
    return data.user;
  }

  function logout() {
    // Clearing this browser is instant, because every caller navigates away on
    // the next line and must not be made to wait for a network round trip.
    // Withdrawing the refresh token on the server follows, unawaited: the
    // endpoint takes the token in its body rather than in a header, so it does
    // not mind that we have already thrown the access token away. Without that
    // call, signing out here would leave the refresh token good for a month
    // wherever else it had been copied.
    const refresh = localStorage.getItem("refresh_token");
    clearSession();
    setUser(null);
    if (refresh) {
      client.post("/api/auth/logout", { refresh_token: refresh }).catch(() => {
        // An unreachable server is not a reason to stay signed in here.
      });
    }
  }

  /** Update the cached user object in place (after a profile change). */
  function updateUser(patch) {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }

  /** Quick sign-in for the demo buttons on the login screen. */
  async function demoLogin(kind) {
    if (kind === "admin") return login("admin@example.com", "admin1234");
    // Demo user: sign in, self-provisioning the account on first use.
    try {
      return await login("demo@example.com", "demo1234");
    } catch (e) {
      if (e?.response?.status === 401) {
        return register("demo", "demo@example.com", "demo1234");
      }
      throw e;
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, demoLogin, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
