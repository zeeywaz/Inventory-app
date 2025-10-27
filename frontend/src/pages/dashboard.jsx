import React from 'react';
import '../styles/dashboard.css';
import { useData } from '../contexts/DataContext'; // <-- 1. ADD THIS IMPORT
import {
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  BarChart,
  Users,
  Briefcase,
  PiggyBank,
  ArrowUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// --- StatCard and SummaryItem components go here ---
// (Copy them from your file)
function StatCard({ title, value, subValue, icon, color }) {
  return (
    <div className="card stat-card" style={{ '--card-color': color }}>
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-subvalue">
          {subValue === '$0.00 revenue' && <ArrowUp size={14} color="#10b981" />}
          {subValue}
        </span>
      </div>
      <div className="stat-icon" style={{ color }}>
        {icon}
      </div>
    </div>
  );
}
function SummaryItem({ title, subtitle, value, icon, bgColor }) {
  return (
    <div className="summary-item">
      <div className="summary-icon-wrapper" style={{ backgroundColor: bgColor }}>
        {icon}
      </div>
      <div className="summary-text">
        <span className="summary-title">{title}</span>
        <span className="summary-subtitle">{subtitle}</span>
      </div>
      <span className="summary-value">{value}</span>
    </div>
  );
}


// --- Main Dashboard Component ---
// 2. CHANGE THIS TO A DEFAULT EXPORT
export default function Dashboard() {
  const { sales, products, customers } = useData(); // This will now work!

  // --- Calculations ---
  const todaySalesCount = 0;
  const todayRevenue = 0.0;
  // Use .length check to prevent error if products is undefined
  const allStocked = products?.length || 0;
  const todayProfit = 0.0;
  const outstandingCredit = 0.0;
  const creditCustomers = 0;

  const inventoryValue = products?.reduce(
    (sum, p) => sum + (p.costPrice || 0) * (p.quantityInStock || 0),
    0
  ) || 0;
  
  const totalCustomers = customers?.length || 0;
  
  const salesTrendData = [
    { name: 'Tue', sales: 0 },
    { name: 'Wed', sales: 0 },
    { name: 'Thu', sales: 0 },
    { name: 'Fri', sales: 0 },
    { name: 'Sat', sales: 0 },
    { name: 'Sun', sales: 0 },
    { name: 'Mon', sales: 0 },
  ];

  const recentSales = sales?.slice(-5).reverse() || [];

  return (
    <div className="dashboard">
      {/* --- Header --- */}
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Dashboard</h1>
          <p>Welcome back! Here's your business overview.</p>
        </div>
        <div className="header-last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* --- Top Stat Cards --- */}
      <div className="stat-card-grid">
        <StatCard
          title="Today's Sales"
          value={todaySalesCount}
          subValue={`$${todayRevenue.toFixed(2)} revenue`}
          icon={<ShoppingCart size={20} />}
          color="#8b5cf6"
        />
        <StatCard
          title="Inventory"
          value={allStocked}
          subValue="All stocked"
          icon={<Package size={20} />}
          color="#8b5cf6"
        />
        <StatCard
          title="Today's Profit"
          value={`$${todayProfit.toFixed(2)}`}
          subValue="$0.00 - $0.00"
          icon={<TrendingUp size={20} />}
          color="#10b981"
        />
        <StatCard
          title="Outstanding Credit"
          value={`$${outstandingCredit.toFixed(2)}`}
          subValue={`${creditCustomers} customers`}
          icon={<DollarSign size={20} />}
          color="#f59e0b"
        />
      </div>

      {/* --- Main Content Grid --- */}
      <div className="dashboard-main-grid">
        {/* --- Left Column --- */}
        <div className="main-col-left">
          <div className="card sales-trend-card">
            <h2 className="card-title">Sales Trend (Last 7 Days)</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesTrendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

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
                  {recentSales.map((sale) => (
                    <li key={sale.id} className="sales-list-item">
                      <div className="sale-info">
                        <span className="sale-customer">{sale.customerName || 'Walk-in'}</span>
                        <span className="sale-date">{new Date(sale.date).toLocaleDateString()}</span>
                      </div>
                      <span className="sale-total">${sale.totalAmount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* --- Right Column --- */}
        <div className="main-col-right">
          <div className="card payment-methods-card">
            <h2 className="card-title">Payment Methods</h2>
            <div className="empty-state-small">
              <p>No payment data available</p>
            </div>
          </div>

          <div className="card business-summary-card">
            <h2 className="card-title">Business Summary</h2>
            <div className="card-content">
              <SummaryItem
                title="Weekly Revenue"
                subtitle="0 sales"
                value="$0.00"
                icon={<BarChart size={20} />}
                bgColor="#dbeafe"
              />
              <SummaryItem
                title="Inventory Value"
                subtitle={`${allStocked} products`}
                value={`$${inventoryValue.toFixed(2)}`}
                icon={<Briefcase size={20} />}
                bgColor="#ede9fe"
              />
              <SummaryItem
                title="Total Customers"
                subtitle="0 with credit"
                value={totalCustomers}
                icon={<Users size={20} />}
                bgColor="#fee2e2"
              />
              <SummaryItem
                title="Monthly Revenue"
                subtitle="0 sales"
                value="$0.00"
                icon={<PiggyBank size={20} />}
                bgColor="#dcfce7"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
