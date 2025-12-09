// src/pages/dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import '../styles/dashboard.css';
import api from '../api'; 
import { useAuth } from '../contexts/AuthContext';
import { 
  ShoppingCart, TrendingUp, BarChart, Users, Briefcase, 
  X, Truck, CreditCard, ArrowDownLeft, ArrowUpRight 
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const fmt = (amt) => `₨ ${(Number(amt) || 0).toFixed(2)}`;

// --- Sale Detail Modal (Unchanged) ---
function SaleDetailModal({ isOpen, onClose, sale }) {
  if (!isOpen || !sale) return null;
  
  const total = sale.total_amount ?? sale.totalAmount ?? 0;
  const customerName = sale.customer_name ?? sale.customerName ?? 'Walk-in';
  const vehicle = sale.vehicle_number ?? sale.vehicleNumber;

  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content sale-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>Sale Details (#{String(sale.sale_no || sale.id).slice(-6)})</h3>
          <button type="button" className="bill-modal-close" onClick={onClose} aria-label="Close details"><X size={20} /></button>
        </div>
        <div className="bill-modal-body">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
            <div>
                <span className="small" style={{display:'block', color:'#6b7280'}}>Date</span>
                <strong>{new Date(sale.date).toLocaleString()}</strong>
            </div>
            <div>
                <span className="small" style={{display:'block', color:'#6b7280'}}>Customer</span>
                <strong>{customerName}</strong>
            </div>
            {vehicle && (
                <div>
                    <span className="small" style={{display:'block', color:'#6b7280'}}>Vehicle</span>
                    <strong>{vehicle}</strong>
                </div>
            )}
             <div>
                <span className="small" style={{display:'block', color:'#6b7280'}}>Payment</span>
                <strong style={{textTransform:'capitalize'}}>{sale.payment_method || 'Cash'}</strong>
            </div>
          </div>

          <h4>Items</h4>
          <div className="bill-table-wrapper">
            <table className="bill-table detail-table">
              <thead><tr><th>Product</th><th style={{textAlign:'center'}}>Qty</th><th style={{textAlign:'right'}}>Unit</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
              <tbody>
                {(sale.lines || []).map((ln, i) => (
                  <tr key={i}>
                    <td>{ln.product_name || ln.productName}</td>
                    <td style={{textAlign:'center'}}>{ln.quantity}</td>
                    <td style={{textAlign:'right'}}>{fmt(ln.unit_price || ln.unitPrice)}</td>
                    <td style={{textAlign:'right'}}>{fmt(ln.line_total || ((ln.unit_price || 0) * (ln.quantity || 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bill-summary-section detail-summary">
            <div className="summary-line grand-total-line">
              <span className="grand-total-label">Grand Total</span>
              <span className="grand-total-value">{fmt(total)}</span>
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

// --- Helper for Stat Cards ---
function StatCard({ title, value, subValue, color, icon }) {
  return (
    <div className="card stat-card" style={{ '--card-color': color }}>
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-subvalue">{subValue}</span>
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---
export default function Dashboard() {
  const { user } = useAuth() || {};
  
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
  // const isStaff = user?.role === 'staff';

  // State for data
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [detailSale, setDetailSale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        // Fetch all necessary data points
        const [salesRes, productsRes, customersRes, expensesRes, poRes] = await Promise.all([
          api.get('/sales/'),
          api.get('/products/'),
          api.get('/customers/'),
          api.get('/expenses/'),
          api.get('/purchase-orders/')
        ]);

        const getResults = (res) => Array.isArray(res.data) ? res.data : (res.data.results || []);

        setSales(getResults(salesRes));
        setProducts(getResults(productsRes));
        setCustomers(getResults(customersRes));
        setExpenses(getResults(expensesRes));
        setPurchaseOrders(getResults(poRes));

      } catch (error) {
        console.error("Dashboard data fetch failed:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // --- 1. KEY METRICS CALCULATIONS ---
  const todayStr = new Date().toDateString();
  
  // Sales Logic
  const todaySalesRecords = sales.filter((s) => new Date(s.date).toDateString() === todayStr);
  const todaySalesCount = todaySalesRecords.length;
  const todayRevenue = todaySalesRecords.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
  
  // Inventory Logic
  const allStocked = products.length;
  const inventoryValue = products.reduce((sum, p) => 
    sum + ((Number(p.cost_price) || 0) * (Number(p.quantity_in_stock) || 0)), 0);

  // --- 2. BUSINESS SUMMARY LOGIC (NEW) ---
  
  // A. Today's Expenses
  const todayExpenses = expenses
    .filter(e => new Date(e.date).toDateString() === todayStr)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // B. Supplier Payables (Outstanding payments to suppliers)
  const supplierPayables = purchaseOrders.reduce((sum, po) => {
    if (po.status === 'cancelled') return sum;
    const total = Number(po.total_amount) || 0;
    const paid = Number(po.amount_paid) || 0;
    const due = total - paid;
    return sum + (due > 0 ? due : 0);
  }, 0);

  // C. Customer Receivables (Outstanding credit given to customers)
  const customerReceivables = customers.reduce((sum, c) => sum + (Number(c.credited_amount) || 0), 0);

  // --- 3. CHART & RECENT SALES ---
  const salesTrendData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d);
    }
    return last7Days.map(date => {
      const dateStr = date.toDateString();
      const daysSales = sales.filter(s => new Date(s.date).toDateString() === dateStr);
      const dailyTotal = daysSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: dailyTotal
      };
    });
  }, [sales]);

  const recentSales = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const tStr = today.toDateString();
    const yStr = yesterday.toDateString();

    return sales.filter(s => {
      const sDate = new Date(s.date).toDateString();
      return sDate === tStr || sDate === yStr;
    });
  }, [sales]);

  function openDetail(sale) { setDetailSale(sale); setDetailOpen(true); }
  function closeDetail() { setDetailSale(null); setDetailOpen(false); }

  if (loading) {
    return <div className="dashboard" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'50vh', color:'#6b7280'}}>Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.username || 'User'}! Here's your business overview.</p>
        </div>
        <div className="header-last-updated">Last updated: {new Date().toLocaleTimeString()}</div>
      </div>

      {/* Top Stats - Quick Glances */}
      <div className="stat-card-grid">
        <div style={{ gridColumn: isAdmin ? undefined : 'span 1' }}>
          <StatCard 
            title="Today's Sales" 
            value={todaySalesCount} 
            subValue="transactions" 
            color="#00c4d2ff" 
          />
        </div>

        <div>
          <StatCard 
            title="Inventory Items" 
            value={allStocked} 
            subValue="Unique Products" 
            color="#8b5cf6" 
          />
        </div>

        {isAdmin && (
          <>
            <div>
              <StatCard 
                title="Today's Revenue" 
                value={fmt(todayRevenue)} 
                subValue="Gross Income" 
                color="#10b981" 
              />
            </div>
            <div>
              <StatCard 
                title="Today's Expenses" 
                value={fmt(todayExpenses)} 
                subValue="Operational Cost" 
                color="#ef4444" 
              />
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
                    <Tooltip 
                      formatter={(value) => [`Rs ${value.toFixed(2)}`, 'Revenue']}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card recent-sales-card">
            <div className="card-header">
              <h2 className="card-title">Recent Sales (Today & Yesterday)</h2>
              <span className="count-badge">{recentSales.length}</span>
            </div>
            <div className="card-content">
              {recentSales.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={48} className="empty-icon" />
                  <p>No sales recorded in the last 48 hours.</p>
                </div>
              ) : (
                <ul className="sales-list">
                  {recentSales.map((sale) => {
                    const total = Number(sale.total_amount || 0);
                    const isToday = new Date(sale.date).toDateString() === todayStr;
                    return (
                      <li
                        key={sale.id}
                        className="sales-list-item"
                        onClick={() => openDetail(sale)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(sale); }}
                      >
                        <div className="sale-info">
                          <span className="sale-customer">{sale.customer_name || sale.customerName || 'Walk-in'}</span>
                          <span className="sale-date">
                            {isToday ? 'Today' : 'Yesterday'} • {new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <span className="sale-total">{fmt(total)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Admin-only Financial Summary */}
        {isAdmin && (
          <div className="main-col-right">
            <div className="card business-summary-card">
              <h2 className="card-title">Financial Health</h2>
              <div className="card-content">
                
                {/* 1. Accounts Receivable (Money People Owe You) */}
                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#dbeafe', color: '#2563eb' }}>
                    <ArrowDownLeft size={20} />
                  </div>
                  <div className="summary-text">
                    <span className="summary-title">Customer Credit</span>
                    <span className="summary-subtitle">Accounts Receivable</span>
                  </div>
                  <span className="summary-value">{fmt(customerReceivables)}</span>
                </div>

                {/* 2. Accounts Payable (Money You Owe Suppliers) */}
                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
                    <Truck size={20} />
                  </div>
                  <div className="summary-text">
                    <span className="summary-title">Supplier Due</span>
                    <span className="summary-subtitle">Accounts Payable</span>
                  </div>
                  <span className="summary-value">{fmt(supplierPayables)}</span>
                </div>

                {/* 3. Operational Expenses (Today) */}
                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                    <CreditCard size={20} />
                  </div>
                  <div className="summary-text">
                    <span className="summary-title">Daily Expenses</span>
                    <span className="summary-subtitle">Operational Costs</span>
                  </div>
                  <span className="summary-value">{fmt(todayExpenses)}</span>
                </div>

                {/* 4. Asset Value */}
                <div className="summary-item">
                  <div className="summary-icon-wrapper" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>
                    <Briefcase size={20} />
                  </div>
                  <div className="summary-text">
                    <span className="summary-title">Inventory Asset</span>
                    <span className="summary-subtitle">Total Cost Basis</span>
                  </div>
                  <span className="summary-value">{fmt(inventoryValue)}</span>
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