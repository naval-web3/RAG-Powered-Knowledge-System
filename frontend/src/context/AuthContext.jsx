import { createContext, useContext, useState } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  function persist(token, userObj) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  }

  async function login(email, password) {
    const { data } = await client.post("/api/auth/login", { email, password });
    persist(data.access_token, data.user);
    return data.user;
  }

  async function register(username, email, password) {
    const { data } = await client.post("/api/auth/register", {
      username,
      email,
      password,
    });
    persist(data.access_token, data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
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
