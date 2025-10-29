// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * AuthContext
 * user object shape (example):
 * {
 *   id: 1,
 *   username: "admin",
 *   role: "admin" | "staff",
 *   token: "...."
 * }
 */

const STORAGE_KEY = 'demo_user';

const AuthContext = createContext({
  user: null,
  login: (userObj) => {},
  loginAs: (username, role) => {},
  logout: () => {},
  setUser: () => {},
  isAdmin: false,
  isStaff: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // normalize role
        const role = normalizeRole(parsed?.role);
        setUser({ ...parsed, role });
      }
    } catch (err) {
      // ignore localStorage errors
      // console.warn('Auth hydrate failed', err);
    }
  }, []);

  // normalize role to either "admin" or "staff" (defaults to staff)
  function normalizeRole(r) {
    if (!r) return 'staff';
    const rr = String(r).toLowerCase();
    return rr === 'admin' ? 'admin' : 'staff';
  }

  // set user and persist
  function login(userObj) {
    if (!userObj) return;
    const role = normalizeRole(userObj.role);
    const normalized = { ...userObj, role };
    setUser(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      // ignore storage errors
    }
  }

  // convenience helper for demo/test flows
  function loginAs(username, role = 'staff') {
    const demo = {
      id: Date.now(),
      username,
      role: normalizeRole(role),
      token: 'demo-token',
    };
    login(demo);
  }

  function logout() {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // ignore
    }
  }

  const isAdmin = !!user && user.role === 'admin';
  const isStaff = !!user && user.role === 'staff';

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAs,
        logout,
        setUser,
        isAdmin,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
