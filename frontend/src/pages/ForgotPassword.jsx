import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import Icon from "../components/Icon";

/**
 * Forgot-password flow. No email service is configured, so the backend returns
 * a single-use reset code that we display on screen (it stands in for the
 * emailed reset link). The user then enters that code plus a new password.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // "request" | "reset" | "done"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function handleRequest(ev) {
    ev.preventDefault();
    setApiError("");
    if (!emailValid(email)) {
      setErrors({ email: true });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { data } = await client.post("/api/auth/forgot-password", { email });
      setIssuedCode(data.code);
      setExpiresIn(data.expires_in_minutes);
      setCode(data.code); // pre-fill so the demo flow is one click onward
      setStep("reset");
    } catch (err) {
      setApiError(
        err?.response?.data?.detail || "Couldn't start the reset. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(ev) {
    ev.preventDefault();
    setApiError("");
    const e = {};
    if (!code.trim()) e.code = true;
    if (password.length < 6) e.password = true;
    if (confirm !== password) e.confirm = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await client.post("/api/auth/reset-password", {
        email,
        code: code.trim(),
        new_password: password,
      });
      setStep("done");
    } catch (err) {
      setApiError(
        err?.response?.data?.detail || "Couldn't reset the password. Please try again."
      );
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
          <h2>Locked out?<br /><em>Reset it here.</em></h2>
          <ul className="auth-points">
            <li><Icon name="check" className="icon-sm" /><span>Each reset code works once and expires automatically.</span></li>
            <li><Icon name="check" className="icon-sm" /><span>Only a hash of the code is kept on the server.</span></li>
          </ul>
        </div>
        <div className="side-foot">MCSP-232 · MCA Project · IGNOU</div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {step === "request" && (
            <>
              <h1>Reset your password</h1>
              <p className="sub">Enter your account email and we'll issue a reset code.</p>

              {apiError && (
                <div className="badge badge-red" style={{ display: "flex", width: "100%", marginBottom: 18, padding: "10px 14px", borderRadius: 12 }}>
                  <Icon name="alert" className="icon-sm" /> {apiError}
                </div>
              )}

              <form onSubmit={handleRequest} noValidate>
                <div className={`field ${errors.email ? "invalid" : ""}`}>
                  <label className="label" htmlFor="fp-email">Email address</label>
                  <input className="input" type="email" id="fp-email" placeholder="you@example.com"
                    autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <span className="field-error">Please enter a valid email address.</span>
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                  {busy ? "Requesting…" : "Request reset code"}
                </button>
              </form>

              <p className="auth-alt">Remembered it? <Link to="/login">Back to sign in</Link></p>
            </>
          )}

          {step === "reset" && (
            <>
              <h1>Enter your code</h1>
              <p className="sub">Use the code below to set a new password for <b>{email}</b>.</p>

              <div className="badge badge-green" style={{ display: "block", width: "100%", marginBottom: 8, padding: "14px 16px", borderRadius: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}>Your reset code</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.22em", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>{issuedCode}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Expires in {expiresIn} minutes · single use</div>
              </div>
              <p className="sub" style={{ fontSize: 12, marginBottom: 18 }}>
                In production this code would be emailed to you. It's shown here because no mail server is configured for the project.
              </p>

              {apiError && (
                <div className="badge badge-red" style={{ display: "flex", width: "100%", marginBottom: 18, padding: "10px 14px", borderRadius: 12 }}>
                  <Icon name="alert" className="icon-sm" /> {apiError}
                </div>
              )}

              <form onSubmit={handleReset} noValidate>
                <div className={`field ${errors.code ? "invalid" : ""}`}>
                  <label className="label" htmlFor="fp-code">Reset code</label>
                  <input className="input" type="text" id="fp-code" placeholder="6-character code"
                    style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}
                    value={code} onChange={(e) => setCode(e.target.value)} />
                  <span className="field-error">Please enter the reset code.</span>
                </div>
                <div className={`field ${errors.password ? "invalid" : ""}`}>
                  <label className="label" htmlFor="fp-pass">New password</label>
                  <div className="input-wrap">
                    <input className="input" type={showPass ? "text" : "password"} id="fp-pass"
                      placeholder="••••••••" autoComplete="new-password"
                      value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="btn-icon trail" aria-label="Show password"
                      onClick={() => setShowPass((s) => !s)}>
                      <Icon name={showPass ? "eye-off" : "eye"} className="icon-sm" />
                    </button>
                  </div>
                  <span className="field-error">Password must be at least 6 characters.</span>
                </div>
                <div className={`field ${errors.confirm ? "invalid" : ""}`}>
                  <label className="label" htmlFor="fp-confirm">Confirm new password</label>
                  <input className="input" type={showPass ? "text" : "password"} id="fp-confirm"
                    placeholder="••••••••" autoComplete="new-password"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  <span className="field-error">Passwords don't match.</span>
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                  {busy ? "Resetting…" : "Reset password"}
                </button>
              </form>

              <p className="auth-alt"><Link to="/login">Back to sign in</Link></p>
            </>
          )}

          {step === "done" && (
            <>
              <h1>Password updated</h1>
              <p className="sub">Your password has been reset. You can now sign in with your new password.</p>
              <button className="btn btn-primary btn-block" type="button" onClick={() => navigate("/login")}>
                Go to sign in
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
