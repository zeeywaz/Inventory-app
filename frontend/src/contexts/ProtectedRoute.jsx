// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Wait for Auth Check to finish (prevents kicking users out while reloading)
  if (loading) {
    return <div className="loading-screen">Loading...</div>; 
  }

  // 2. Not Logged In? -> Go to Login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Page requires Admin but user is NOT Admin? -> Go to Dashboard
  if (requireAdmin && (user.role || '').toLowerCase() !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // 4. Access Granted
  return children;
};

export default ProtectedRoute;