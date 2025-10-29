// src/pages/dashboard.jsx
import React, { useState } from 'react';
import '../styles/dashboard.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, Package, TrendingUp, DollarSign, BarChart, Users, Briefcase, Wallet } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { X } from 'lucide-react';

// small Sale Detail modal (reused UI)
function SaleDetailModal({ isOpen, onClose, sale }) {
  if (!isOpen || !sale) return null;
  const fmt = (amt) => `₨${(Number(amt) || 0).toFixed(2)}`;
  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content sale-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>Sale Details (#{(sale.id || '').toString().slice(-6)})</h3>
          <button type="button" className="bill-modal-close" onClick={onClose} aria-label="Close details"><X size={20} /></button>
        </div>
        <div className="bill-modal-body">
          <div><strong>Date:</strong> {new Date(sale.date).toLocaleString()}</div>
          <div><strong>Customer:</strong> {sale.customerName || 'Walk-in'}</div>
          {sale.vehicleNumber && <div><strong>Vehicle #:</strong> {sale.vehicleNumber}</div>}
          <h4>Items</h4>
          <div className="bill-table-wrapper">
            <table className="bill-table detail-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
              <tbody>
                {(sale.lines || []).map((ln, i) => (
                  <tr key={i}>
                    <td>{ln.productName}</td>
                    <td>{ln.quantity}</td>
                    <td>{fmt(ln.unitPrice)}</td>
                    <td>{fmt(ln.unitPrice * (ln.quantity || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bill-summary-section detail-summary">
            <div className="summary-line grand-total-line">
              <span className="grand-total-label">Grand Total</span>
              <span className="grand-total-value">{fmt(sale.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="bill-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { sales = [], products = [], customers = [] } = useData() || {};
  const { isAdmin = false, isStaff = false } = useAuth() || {};
  const [detailSale, setDetailSale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const todayStr = new Date().toDateString();
  const todaySalesRecords = (sales || []).filter((s) => new Date(s.date).toDateString() === todayStr);
  const todaySalesCount = todaySalesRecords.length;
  const todayRevenue = todaySalesRecords.reduce((sum, s) => sum + (Number(s.totalAmount ?? s.total_amount ?? 0) || 0), 0);
  const allStocked = (products || []).length;
  const inventoryValue = (products || []).reduce((sum, p) => sum + (Number(p.costPrice ?? p.cost_price ?? 0) || 0) * (Number(p.quantityInStock ?? p.quantity_in_stock ?? 0) || 0), 0);
  const totalCustomers = (customers || []).length;

  const salesTrendData = [{ name: 'Tue', sales: 0 }, { name: 'Wed', sales: 0 }, { name: 'Thu', sales: 0 }, { name: 'Fri', sales: 0 }, { name: 'Sat', sales: 0 }, { name: 'Sun', sales: 0 }, { name: 'Mon', sales: 0 }];

  const recentSales = (sales || []).slice(-5).reverse();

  function openDetail(sale) { setDetailSale(sale); setDetailOpen(true); }
  function closeDetail() { setDetailSale(null); setDetailOpen(false); }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-title"><h1>Dashboard</h1><p>Welcome back! Here's your business overview.</p></div>
        <div className="header-last-updated">Last updated: {new Date().toLocaleTimeString()}</div>
      </div>

      {/* Stat cards: staff sees fewer */}
      <div className="stat-card-grid">
        <div style={{ gridColumn: isAdmin ? undefined : 'span 1' }}>
          <div className="card stat-card" style={{ ['--card-color']: '#00c4d2ff' }}>
            <div className="stat-card-info"><span className="stat-title">Today's Sales</span><span className="stat-value">{todaySalesCount}</span><span className="stat-subvalue">transactions</span></div>
          </div>
        </div>

        <div>
          <div className="card stat-card" style={{ ['--card-color']: '#8b5cf6' }}>
            <div className="stat-card-info"><span className="stat-title">Inventory</span><span className="stat-value">{allStocked}</span><span className="stat-subvalue">All stocked</span></div>
          </div>
        </div>

        {isAdmin && (
          <>
            <div>
              <div className="card stat-card" style={{ ['--card-color']: '#10b981' }}>
                <div className="stat-card-info"><span className="stat-title">Today's Profit</span><span className="stat-value">₨0.00</span><span className="stat-subvalue">$0.00 - $0.00</span></div>
              </div>
            </div>
            <div>
              <div className="card stat-card" style={{ ['--card-color']: '#f59e0b' }}>
                <div className="stat-card-info"><span className="stat-title">Outstanding Credit</span><span className="stat-value">₨0.00</span><span className="stat-subvalue">0 customers</span></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="dashboard-main-grid">
        <div className="main-col-left">
          {isAdmin && (
            <div className="card sales-trend-card">
              <h2 className="card-title">Sales Trend (Last 7 Days)</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card recent-sales-card">
            <div className="card-header">
              <h2 className="card-title">Recent Sales</h2>
              <span className="count-badge">{recentSales.length}</span>
            </div>
            <div className="card-content">
              {recentSales.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={48} className="empty-icon" />
                  <p>No sales recorded yet</p>
                </div>
              ) : (
                <ul className="sales-list">
                  {recentSales.map((sale) => {
                    const total = Number(sale.totalAmount || sale.total_amount || 0) || 0;
                    return (
                      <li
                        key={sale.id ?? sale.date}
                        className="sales-list-item"
                        onClick={() => openDetail(sale)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(sale); }}
                        aria-label={`Open sale ${sale.id}`}
                      >
                        <div className="sale-info">
                          <span className="sale-customer">{sale.customerName ?? 'Walk-in'}</span>
                          <span className="sale-date">{new Date(sale.date).toLocaleDateString()}</span>
                        </div>
                        <span className="sale-total">{(isStaff && !isAdmin) ? '—' : `₨${total.toFixed(2)}`}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* admin-only right column */}
        {isAdmin && (
          <div className="main-col-right">
            <div className="card payment-methods-card">
              <h2 className="card-title">Payment Methods</h2>
              <div className="empty-state-small"><p>No payment data available</p></div>
            </div>

            <div className="card business-summary-card">
              <h2 className="card-title">Business Summary</h2>
              <div className="card-content">
                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#dbeafe' }}><BarChart size={18} /></div>
                  <div className="summary-text"><span className="summary-title">Weekly Revenue</span><span className="summary-subtitle">0 sales</span></div>
                  <span className="summary-value">₨0.00</span>
                </div>

                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#ede9fe' }}><Briefcase size={18} /></div>
                  <div className="summary-text"><span className="summary-title">Inventory Value</span><span className="summary-subtitle">{allStocked} products</span></div>
                  <span className="summary-value">₨{inventoryValue.toFixed(2)}</span>
                </div>

                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#fee2e2' }}><Users size={18} /></div>
                  <div className="summary-text"><span className="summary-title">Total Customers</span><span className="summary-subtitle">0 with credit</span></div>
                  <span className="summary-value">{totalCustomers}</span>
                </div>

                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#dcfce7' }}><Wallet size={18} /></div>
                  <div className="summary-text"><span className="summary-title">Monthly Revenue</span><span className="summary-subtitle">0 sales</span></div>
                  <span className="summary-value">₨0.00</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <SaleDetailModal isOpen={detailOpen} onClose={closeDetail} sale={detailSale} />
    </div>
  );
}
