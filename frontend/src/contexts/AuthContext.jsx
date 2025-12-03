// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api'; // Import your Axios client

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // 'loading' prevents the app from rendering ProtectedRoutes 
  // before we check if the user is actually logged in.
  const [loading, setLoading] = useState(true);

  // --- 1. CHECK SESSION ON APP LOAD ---
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      
      if (token) {
        // Optimistically set the header so the request works
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        try {
          // Verify the token AND get fresh user details (like 'role')
          // This hits the 'current_user' view in your backend
          const response = await api.get('/auth/me/');
          setUser(response.data);
        } catch (error) {
          console.error("Session expired or invalid:", error);
          // If the check fails (e.g., token expired and refresh failed), logout
          logout();
        }
      }
      
      // Finished checking, let the app render
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // --- 2. LOGIN FUNCTION ---
  const login = async (username, password) => {
    try {
      // A. Get the tokens
      // Note: We use '/token/', axios adds '/api' from baseURL
      const response = await api.post('/token/', {
        username,
        password,
      });

      const { access, refresh } = response.data;

      // B. Save to LocalStorage
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // C. Set the Header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // D. Fetch the User Profile immediately
      // This ensures we have the 'role' and 'name' ready for the UI
      const userResponse = await api.get('/auth/me/');
      
      setUser(userResponse.data);
      return userResponse.data;

    } catch (error) {
      // If anything fails, clean up
      logout();
      throw error; 
    }
  };

  // --- 3. LOGOUT FUNCTION ---
  const logout = () => {
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Remove the header so we don't accidentally send invalid tokens
    delete api.defaults.headers.common['Authorization'];
  };

  // --- 4. CALCULATE FLAGS ---
  // These will automatically update whenever 'user' changes.
  // We use optional chaining (?.) so it doesn't crash if user is null.
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  const authValue = {
    user,
    isAdmin, // <--- Global Admin Flag
    isStaff, // <--- Global Staff Flag
    login,
    logout,
    isLoading: loading, // Expose loading state if pages need it
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={authValue}>
      {/* Don't render children until we know if we are logged in or not */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};