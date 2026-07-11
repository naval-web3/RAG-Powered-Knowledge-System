import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { strengthOf } from "../utils";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = strengthOf(password);

  function validate() {
    const e = {};
    if (name.trim().length < 3) e.name = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = true;
    if (password.length < 6) e.password = true;
    if (confirm !== password) e.confirm = true;
    if (!terms) e.terms = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setApiError("");
    if (!validate()) return;
    setBusy(true);
    try {
      await register(name.trim(), email, password);
      navigate("/");
    } catch (err) {
      setApiError(err?.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <aside className="auth-side">
        <Link className="brand" to="/welcome">
          <span className="brand-mark"><Icon name="spark" /></span>
          <span className="brand-name">Retrieva</span>
        </Link>
        <div className="auth-quote">
          <h2>Build a knowledge base<br /><em>that answers back.</em></h2>
          <ul className="auth-points">
            <li><Icon name="check" className="icon-sm" /><span><b>Upload anything.</b> PDF, DOCX and TXT files up to 25 MB each.</span></li>
            <li><Icon name="check" className="icon-sm" /><span><b>Automatic pipeline.</b> Every upload is chunked and embedded without a single manual step.</span></li>
            <li><Icon name="check" className="icon-sm" /><span><b>Conversation history.</b> Every chat is saved, so you can search it later and pick up where you left off.</span></li>
          </ul>
        </div>
        <div className="side-foot">MCSP-232 · MCA Project · IGNOU</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1>Create your account</h1>
          <p className="sub">A few details and you're in.</p>

          {apiError && (
            <div className="badge badge-red" style={{ display: "flex", width: "100%", marginBottom: 18, padding: "10px 14px", borderRadius: 12 }}>
              <Icon name="alert" className="icon-sm" /> {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field ${errors.name ? "invalid" : ""}`}>
              <label className="label" htmlFor="reg-name">Full name</label>
              <input className="input" type="text" id="reg-name" placeholder="Naval Chaudhary"
                autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <span className="field-error">Please enter a name (at least 3 characters).</span>
            </div>
            <div className={`field ${errors.email ? "invalid" : ""}`}>
              <label className="label" htmlFor="reg-email">Email address</label>
              <input className="input" type="email" id="reg-email" placeholder="you@example.com"
                autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="field-error">Please enter a valid email address.</span>
            </div>
            <div className={`field ${errors.password ? "invalid" : ""}`}>
              <label className="label" htmlFor="reg-pass">Password</label>
              <div className="input-wrap">
                <input className="input" type={showPass ? "text" : "password"} id="reg-pass"
                  placeholder="At least 6 characters" autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="btn-icon trail" aria-label="Show password"
                  onClick={() => setShowPass((s) => !s)}>
                  <Icon name={showPass ? "eye-off" : "eye"} className="icon-sm" />
                </button>
              </div>
              <div className="strength" data-level={strength.level}>
                <span></span><span></span><span></span><span></span>
              </div>
              <div className="strength-label">{strength.label}</div>
              <span className="field-error">Password must be at least 6 characters.</span>
            </div>
            <div className={`field ${errors.confirm ? "invalid" : ""}`}>
              <label className="label" htmlFor="reg-pass2">Confirm password</label>
              <input className="input" type="password" id="reg-pass2" placeholder="Repeat password"
                autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <span className="field-error">Passwords do not match.</span>
            </div>
            <div className={`field ${errors.terms ? "invalid" : ""}`}>
              <label className="checkbox-row">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>I agree to the <span style={{ color: "var(--accent)" }}>terms of use</span> and acknowledge this is an academic prototype.</span>
              </label>
              <span className="field-error">Please accept the terms to continue.</span>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="auth-alt">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </main>
    </div>
  );
}
