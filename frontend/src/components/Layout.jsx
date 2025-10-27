import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import './Layout.css'; // <-- Import the new CSS file

export function Layout() {
  const { user, logout } = useAuth();

  // Mock user and logout if not in context
  const appUser = user || { name: 'Shop Owner', role: 'Admin' };
  const appLogout = logout || (() => console.log('Logout clicked'));

  return (
    // Use className instead of inline style
    <div className="layout-container">
      <Sidebar user={appUser} onLogout={appLogout} />

      {/* Use className instead of inline style */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}