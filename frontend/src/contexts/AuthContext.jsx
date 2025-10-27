import React, { createContext, useContext, useState } from 'react';

// This is a mock user. In the future, this will come from your Django API
const MOCK_ADMIN_USER = {
  id: '1',
  name: 'Shop Owner',
  role: 'Admin',
};

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  // We'll log you in as Admin by default for testing
  const [user, setUser] = useState(MOCK_ADMIN_USER);

  const login = () => {
    // In the future, you'll call your Django API here
    console.log('Logging in...');
    setUser(MOCK_ADMIN_USER);
  };

  const logout = () => {
    console.log('Logging out...');
    setUser(null);
  };

  const value = { user, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
