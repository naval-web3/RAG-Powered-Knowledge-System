import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full px-3.5 py-2.5 bg-surface2 border border-hairline rounded-xl text-white placeholder:text-muted/60 focus:outline-none focus:border-move/60 transition";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ink">
      <form onSubmit={handleSubmit} className="bg-surface p-8 rounded-2xl border border-hairline w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Create account</h1>
        <p className="text-sm text-muted mb-6">Start building your knowledge base</p>

        {error && <div className="mb-4 text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{error}</div>}

        <label className="block text-sm font-medium text-muted mb-1.5">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} className={`${field} mb-4`} />

        <label className="block text-sm font-medium text-muted mb-1.5">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`${field} mb-4`} />

        <label className="block text-sm font-medium text-muted mb-1.5">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={`${field} mb-6`} />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-move-gradient text-white py-2.5 rounded-xl font-semibold hover:opacity-95 disabled:opacity-50 transition ring-glow"
        >
          {loading ? "Creating…" : "Create account"}
        </button>

        <p className="text-sm text-muted mt-5 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-stand font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
