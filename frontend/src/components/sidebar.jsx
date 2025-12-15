// src/components/Sidebar.jsx
import React, { useState } from 'react';
import './sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  AlertTriangle // Added for the warning icon
} from 'lucide-react';

export function Sidebar({ user: propUser, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  
  const user = propUser || authUser;
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const activePage = (location.pathname || '/').toLowerCase();

  // State for the logout confirmation modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    logout();
    if (onLogout) onLogout();
    navigate('/login');
    setShowLogoutConfirm(false);
  };

  const NavLink = ({ to, icon, text }) => {
    const normalizedTo = (to || '').toLowerCase();
    const isActive = normalizedTo === '/' 
      ? activePage === '/' || activePage === '/dashboard'
      : activePage.startsWith(normalizedTo);

    return (
      <Link 
        to={to} 
        className={`nav-link ${isActive ? 'active' : ''}`}
        title={text}
      >
        {icon}
        <span>{text}</span>
      </Link>
    );
  };

  return (
    <>
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="logo" aria-hidden>
            <Settings size={24} />
          </div>
          <div className="brand">
            <span className="brand-name">Modi-Act</span>
            <span className="brand-sub"> Inventory System</span>
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
            {isAdmin && <NavLink to="/suppliers" icon={<Truck size={18} />} text="Suppliers" />}
            {isAdmin && <NavLink to="/purchase-orders" icon={<FileText size={18} />} text="Purchase Orders" />}
            <NavLink to="/expenses" icon={<DollarSign size={18} />} text="Expenses" />
          </div>

          {isAdmin && (
            <div className="nav-group">
              <span className="nav-group-title">HR</span>
              <NavLink to="/attendance" icon={<Calendar size={18} />} text="Attendance" />
            </div>
          )}

          {isAdmin && (
            <div className="nav-group">
              <span className="nav-group-title">System</span>
              <NavLink to="/analysis" icon={<BarChart size={18} />} text="Reports" />
              <NavLink to="/backups" icon={<DatabaseBackup size={18} />} text="Backups" />
              <NavLink to="/settings" icon={<Settings size={18} />} text="Settings" />
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile" title={`Logged in as ${user?.username || 'User'}`}>
            <div className="user-avatar" aria-hidden>
              <User size={20} />
            </div>
            <div className="user-info">
              <span className="user-name">
                 {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : (user?.username || 'User')}
              </span>
              <span className="user-role">
                {user?.role ? user.role.toUpperCase() : 'STAFF'}
              </span>
            </div>
          </div>

          <button 
            className="logout-button" 
            onClick={() => setShowLogoutConfirm(true)} 
            aria-label="Logout"
            title="Sign out"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* --- Logout Confirmation Modal --- */}
      {showLogoutConfirm && (
        <div className="logout-overlay">
          <div className="logout-modal">
            <div className="logout-icon-wrapper">
              <AlertTriangle size={32} />
            </div>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to end your session?</p>
            <div className="logout-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmLogout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}