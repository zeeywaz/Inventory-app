import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- CONTEXTS (This is the fix for the blank screen!) ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';

// --- YOUR COMPONENTS & PAGES ---
import { Layout } from './components/Layout';
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
// ... import your other pages here as you build them ...

/**
 * Guards your app pages.
 * If you're not logged in, it redirects you to /login.
 * If you are, it shows the <Layout> (sidebar + page).
 */
function ProtectedRoutes() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

/**
 * Guards your login page.
 * If you are already logged in, it redirects you to the dashboard.
 */
function PublicRoutes() {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />; // Show the login page
}

/**
 * The main App component.
 * Wraps everything in providers and sets up routes.
 */
export default function App() {
  return (
    // All components need to be inside these providers!
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            
            {/* --- Public Routes (like /login) --- */}
            <Route element={<PublicRoutes />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* --- Protected Routes (your app) --- */}
            {/* All routes inside here will have the sidebar! */}
            <Route path="/" element={<ProtectedRoutes />}>
              <Route index element={<Dashboard />} /> 
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inquiries" element={<InquiriesPage />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/backups" element={<BackupRestore />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* When you're ready, add your other pages:
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/products" element={<ProductsPage />} />
              */}
            </Route>

            {/* --- Catch-all redirect --- */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
        {/* <Toaster /> You'll need to import this when ready */}
      </DataProvider>
    </AuthProvider>
  );
}
