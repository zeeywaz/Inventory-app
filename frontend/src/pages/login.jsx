// src/pages/login.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { Briefcase, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth(); 

  // UI state
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Disable button if fields are empty
  const canSubmit = useMemo(() => {
    return form.username.trim().length > 0 && form.password.trim().length > 0;
  }, [form]);

  function update(field) {
    return (e) => {
      const value = e?.target ? e.target.value : e;
      setForm((f) => ({ ...f, [field]: value }));
      if (err) setErr("");
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    
    if (!canSubmit) {
      setErr("Please enter username and password.");
      return;
    }

    try {
      setIsLoading(true);
      
      // 1. Call the AuthContext
      // We wait for the login function to finish.
      // It returns the user object from the backend (including 'role').
      const userData = await auth.login(form.username, form.password);
      
      // 2. CHECK THE ROLE [New Logic]
      // We can now see exactly who logged in.
      console.log("Login Successful!");
      console.log("User:", userData.username);
      console.log("Role:", userData.role); // This will print 'admin' or 'staff'

      // Optional: You could redirect differently based on role
      // if (userData.role === 'admin') navigate('/admin-dashboard');
      
      // 3. Navigate to the main dashboard
      navigate("/", { replace: true });

    } catch (error) {
      console.error("Login Error Details:", error); // Detailed log for debugging

      // --- ERROR HANDLING ---
      if (error.response) {
        // The server responded with a status code
        if (error.response.status === 401) {
          setErr("Invalid username or password.");
        } else if (error.response.status === 400) {
           setErr("Missing credentials.");
        } else if (error.response.status === 500) {
           setErr("Server error (500). Please check backend terminal.");
        } else {
          setErr(`Login failed (Error ${error.response.status}).`);
        }
      } else if (error.request) {
        // The request was made but no response received (Backend down / CORS issue)
        setErr("Unable to reach the server. Is Django running?");
      } else {
        // Something else happened
        setErr("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main id="main" className="auth-main" role="main">
      <section className="auth-card" aria-label="Login">
        <header className="auth-head">
          <div className="auth-icon" aria-hidden>
            <Briefcase size={48} />
          </div>

          <h1 className="auth-title">Welcome Back!</h1>
          <p className="auth-subtitle">Manage your Inventory Efficiently</p>
        </header>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {/* Username Field */}
          <div className="auth-field">
            <input
              type="text"
              placeholder="Username"
              className="auth-input"
              value={form.username}
              onChange={update("username")}
              required
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div className="auth-field auth-field--password">
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={update("password")}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-pressed={showPwd}
              aria-label={showPwd ? "Hide password" : "Show password"}
              tabIndex={-1} 
            >
              {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="auth-links">
            {/* Future Forgot Password Link */}
          </div>

          {/* Error Message Display */}
          {err && (
            <div className="auth-error" role="alert">
              {err}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-btn" 
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? "Logging in..." : "Sign In"}
          </button>
        </form>

      </section>
    </main>
  );
}