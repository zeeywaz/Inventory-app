import React from 'react';
import './sidebar.css';
import { Link, useLocation } from 'react-router-dom'; // <-- IMPORT Link and useLocation
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
} from 'lucide-react'; // Make sure you ran: npm install lucide-react

export function Sidebar({ user, onLogout }) {
  const location = useLocation(); // <-- Get current page location
  const activePage = location.pathname; // e.g., "/", "/sales"

  // Helper to create a nav link
  const NavLink = ({ to, icon, text }) => {
    const isActive =
      to === '/' ? activePage === '/' : activePage.startsWith(to);

    return (
      <Link
        to={to} // <-- Use "to" prop
        className={`nav-link ${isActive ? 'active' : ''}`}
      >
        {icon}
        <span>{text}</span>
      </Link>
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <Settings size={24} />
        </div>
        <div className="brand">
          <span>AutoMod IMS</span>
          <span>Inventory System</span>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-group">
          <span className="nav-group-title">Main</span>
          <NavLink
            to="/" // <-- Use "to" prop
            icon={<LayoutDashboard size={18} />}
            text="Dashboard"
          />
          <NavLink
            to="/sales"
            icon={<ShoppingCart size={18} />}
            text="Sales"
          />
          <NavLink
            to="/products"
            icon={<Package size={18} />}
            text="Products"
          />
          <NavLink
            to="/customers"
            icon={<Users size={18} />}
            text="Customers"
          />
          <NavLink
            to="/inquiries"
            icon={<MessageSquare size={18} />}
            text="Inquiries"
          />
        </div>

        <div className="nav-group">
          <span className="nav-group-title">Inventory</span>
          <NavLink
            to="/suppliers"
            icon={<Truck size={18} />}
            text="Suppliers"
          />
          <NavLink
            to="/purchase-orders"
            icon={<FileText size={18} />}
            text="Purchase Orders"
          />
          <NavLink
            to="/expenses"
            icon={<DollarSign size={18} />}
            text="Expenses"
          />
        </div>

        <div className="nav-group">
          <span className="nav-group-title">HR</span>
          <NavLink
            to="/attendance"
            icon={<Calendar size={18} />}
            text="Attendance"
          />
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            <User size={20} />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-role">{user?.role || 'Role'}</span>
          </div>
        </div>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
