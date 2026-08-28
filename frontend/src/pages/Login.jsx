import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  function validate() {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = true;
    if (password.length < 6) e.password = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setApiError("");
    if (!validate()) return;
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setApiError(err?.response?.data?.detail || "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo(kind) {
    setApiError("");
    setBusy(true);
    try {
      await demoLogin(kind);
      navigate("/");
    } catch (err) {
      setApiError(err?.response?.data?.detail || "Demo sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <aside className="auth-side">
        <Link className="brand" to="/welcome">
          <img className="brand-mark" src="/logo.png" alt="" width="32" height="32" />
          <span className="brand-name">Retrieva</span>
        </Link>
        <div className="auth-quote">
          <h2>Ask your documents.<br /><em>Get cited answers.</em></h2>
          <ul className="auth-points">
            <li><Icon name="check" className="icon-sm" /><span>Every answer traces back to real passages in your own documents.</span></li>
            <li><Icon name="check" className="icon-sm" /><span>Use cloud GPT-4o or a local Ollama model, and switch per question.</span></li>
            <li><Icon name="check" className="icon-sm" /><span>Sessions are JWT-secured, with separate admin and user roles.</span></li>
          </ul>
        </div>
        <div className="side-foot">MCSP-232 · MCA Project · IGNOU</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="sub">Sign in to continue to your knowledge base.</p>

          {apiError && (
            <div className="badge badge-red" style={{ display: "flex", width: "100%", marginBottom: 18, padding: "10px 14px", borderRadius: 12 }}>
              <Icon name="alert" className="icon-sm" /> {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field ${errors.email ? "invalid" : ""}`}>
              <label className="label" htmlFor="login-email">Email address</label>
              <input className="input" type="email" id="login-email" placeholder="you@example.com"
                autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="field-error">Please enter a valid email address.</span>
            </div>
            <div className={`field ${errors.password ? "invalid" : ""}`}>
              <div className="label-row">
                <label className="label" htmlFor="login-pass">Password</label>
                <Link className="label-link" to="/forgot-password">Forgot password?</Link>
              </div>
              <div className="input-wrap">
                <input className="input" type={showPass ? "text" : "password"} id="login-pass"
                  placeholder="••••••••" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="btn-icon trail" aria-label="Show password"
                  onClick={() => setShowPass((s) => !s)}>
                  <Icon name={showPass ? "eye-off" : "eye"} className="icon-sm" />
                </button>
              </div>
              <span className="field-error">Password must be at least 6 characters.</span>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="auth-divider">or try a demo account</div>
          <div className="demo-row">
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => handleDemo("user")}>
              <Icon name="user" className="icon-sm" /> Demo user
            </button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => handleDemo("admin")}>
              <Icon name="shield" className="icon-sm" /> Demo admin
            </button>
          </div>

          <p className="auth-alt">New here? <Link to="/register">Create an account</Link></p>
        </div>
      </main>
    </div>
  );
}
