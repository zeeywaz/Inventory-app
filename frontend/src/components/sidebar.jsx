// src/components/Sidebar.jsx
import React from 'react';
import './sidebar.css';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  MessageSquare,
  Truck,
  FileText,
  DollarSign,
  Calendar,
  User,
  LogOut,
  DatabaseBackup,
  BarChart,
} from 'lucide-react';

export function Sidebar({ user: propUser, onLogout }) {
  const location = useLocation();
  const activePage = (location.pathname || '/').toLowerCase();

  // prefer prop user if passed, otherwise read from AuthContext
  const auth = useAuth?.() ?? {};
  const authUser = auth.user ?? null;
  const user = propUser ?? authUser;

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';

  // Helper to create a nav link
  const NavLink = ({ to, icon, text }) => {
    const normalizedTo = (to || '').toLowerCase();
    const isActive = normalizedTo === '/'
      ? activePage === '/'
      : activePage.startsWith(normalizedTo);

    return (
      <Link to={to} className={`nav-link ${isActive ? 'active' : ''}`}>
        {icon}
        <span>{text}</span>
      </Link>
    );
  };

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="logo" aria-hidden>
          <Settings size={24} />
        </div>
        <div className="brand">
          <span className="brand-name">AutoMod IMS</span>
          <span className="brand-sub">Inventory System</span>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-group">
          <span className="nav-group-title">Main</span>
          <NavLink to="/" icon={<LayoutDashboard size={18} />} text="Dashboard" />
          <NavLink to="/sales" icon={<ShoppingCart size={18} />} text="Sales" />
          <NavLink to="/products" icon={<Package size={18} />} text="Products" />
          <NavLink to="/customers" icon={<Users size={18} />} text="Customers" />
          <NavLink to="/inquiries" icon={<MessageSquare size={18} />} text="Inquiries" />
        </div>

        <div className="nav-group">
          <span className="nav-group-title">Inventory</span>
          <NavLink to="/suppliers" icon={<Truck size={18} />} text="Suppliers" />
          <NavLink to="/purchase-orders" icon={<FileText size={18} />} text="Purchase Orders" />
          <NavLink to="/expenses" icon={<DollarSign size={18} />} text="Expenses" />
        </div>

        {/* HR: only visible to admin */}
        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-title">HR</span>
            <NavLink to="/attendance" icon={<Calendar size={18} />} text="Attendance" />
          </div>
        )}

        {/* System: only visible to admin */}
        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-title">System</span>
            <NavLink to="/reports" icon={<BarChart size={18} />} text="Reports" />
            <NavLink to="/backups" icon={<DatabaseBackup size={18} />} text="Backups" />
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-profile" title={user?.username ?? 'User'}>
          <div className="user-avatar" aria-hidden>
            <User size={20} />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name ?? user?.username ?? 'User'}</span>
            <span className="user-role">{(user?.role ?? 'Role').toString()}</span>
          </div>
        </div>

        <button className="logout-button" onClick={onLogout} aria-label="Logout">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
