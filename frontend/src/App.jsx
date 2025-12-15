// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- CONTEXTS ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { SettingsProvider } from './contexts/SettingsContext';

// --- COMPONENTS ---
import { Layout } from './components/Layout';
import ProtectedRoute from './contexts/ProtectedRoute';

// --- PAGES ---
import LoginPage from './pages/login';
import Dashboard from './pages/dashboard';
import Sales from './pages/sales';
import ProductsPage from './pages/product';
import CustomersPage from './pages/customers';
import InquiriesPage from './pages/inquiries';
import Suppliers from './pages/suppliers';
import PurchaseOrders from './pages/purchaseorders';
import Expenses from './pages/expenses';
import AttendancePage from './pages/attendance';
import Analysis from './pages/analysis';
import BackupRestore from './pages/backup';
import SettingsPage from './pages/settings';

/**
 * Basic Guard for the Layout itself (Must be logged in to see sidebar)
 */
function LayoutGuard() {
  const { user, loading } = useAuth();
  if (loading) return null; // Don't redirect while checking token
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function PublicRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <SettingsProvider>
        <BrowserRouter>
          <Routes>
            
            {/* --- Public Routes --- */}
            <Route element={<PublicRoutes />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* --- Protected App Routes --- */}
            <Route path="/" element={<LayoutGuard />}>
              
              {/* ACCESSIBLE TO EVERYONE (Admin & Staff) */}
              <Route index element={<Dashboard />} /> 
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inquiries" element={<InquiriesPage />} />
              <Route path="/expenses" element={<Expenses />} />

              {/* 🔒 STRICT ADMIN-ONLY ROUTES */}
              <Route 
                path="/suppliers" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <Suppliers />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/purchase-orders" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <PurchaseOrders />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/attendance" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AttendancePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analysis" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <Analysis />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/backups" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <BackupRestore />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />

            </Route>

            {/* --- Catch-all redirect --- */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
        </SettingsProvider>
      </DataProvider>
    </AuthProvider>
  );
}