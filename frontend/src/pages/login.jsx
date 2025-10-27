import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";
import {Briefcase} from "lucide-react";


export default function LoginPage() {
  const navigate = useNavigate();

  // UI state
  const [step, setStep] = useState("login"); // could be 'login' | 'requestOtp' | 'verifyOtp'
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // form state
  const [form, setForm] = useState({ username: "", password: "" });
  const [otpEmail, setOtpEmail] = useState("");
  const [err, setErr] = useState("");

  // derived
  const canSubmit = useMemo(() => {
    return form.username.trim().length > 0 && form.password.trim().length > 0;
  }, [form]);

  // update helper
  function update(field) {
    return (e) => {
      const value = e?.target ? e.target.value : e;
      setForm((f) => ({ ...f, [field]: value }));
      setErr("");
    };
  }

  // form submit (demo behavior) - replace with real API call
  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!canSubmit) {
      setErr("Please enter username and password.");
      return;
    }

    try {
      setIsLoading(true);

      // Demo login logic:
      // Accept admin/admin123 and staff/staff123 as in your screenshot.
      await new Promise((r) => setTimeout(r, 600)); // simulate network

      const { username, password } = form;
      if (
        (username === "admin" && password === "admin123") ||
        (username === "staff" && password === "staff123")
      ) {
        // redirect after "login"
        // you might want to set a user context / token here
        navigate("/", { replace: true });
        return;
      }

      // invalid credentials:
      setErr("Invalid username or password.");
    } catch (error) {
      console.error(error);
      setErr("Login error — try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main id="main" className="auth-main" role="main">
      <section className="auth-card" aria-label="Login">
        <header className="auth-head">
          {/* circular decorative background created by CSS ::before */}
          <div className="auth-icon" aria-hidden>
            <Briefcase size={48} />
          </div>

          <h1 className="auth-title">Welcome Back!</h1>
          <p className="auth-subtitle">Manage your Inventory Efficiently</p>
        </header>

        {/* ---------------- Login form ---------------- */}
        {step === "login" && (
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <input
                type="text"
                placeholder="Username"
                className="auth-input"
                value={form.username}
                onChange={update("username")}
                required
              />
            </div>

            <div className="auth-field auth-field--password">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                className="auth-input"
                value={form.password}
                onChange={update("password")}
                required
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-pressed={showPwd}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>

            <div className="auth-links">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setOtpEmail(form.username || "");
                  setStep("requestOtp");
                }}
              >
                Forgot Password?
              </button>

              <Link to="/help" className="auth-link-btn" style={{ textDecoration: "none" }}>
                Need help?
              </Link>
            </div>

            {err && <p className="auth-error" role="alert">{err}</p>}

            <button type="submit" className="auth-btn" disabled={!canSubmit || isLoading}>
              {isLoading ? "Logging in..." : "Sign In"}
            </button>

            <div className="auth-demo" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Demo Credentials:</div>
              <div className="small">Admin: <strong>admin</strong> / <em>admin123</em></div>
              <div className="small">Staff: <strong>staff</strong> / <em>staff123</em></div>
            </div>
          </form>
        )}

        {/* ---------------- Request OTP (simple placeholder) ---------------- */}
        {step === "requestOtp" && (
          <div className="auth-form">
            <p className="text-muted">Enter your username or email to request password reset OTP.</p>
            <div className="auth-field">
              <input type="text" className="auth-input" placeholder="Username or email" value={otpEmail} onChange={(e)=>setOtpEmail(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="auth-btn" onClick={() => { /* call reset API */ setStep("login"); }}>Request OTP</button>
              <button className="auth-link-btn" onClick={() => setStep("login")}>Back</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
