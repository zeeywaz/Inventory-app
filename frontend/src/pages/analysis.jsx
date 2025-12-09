// src/pages/analysis.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/analysis.css';
import api from '../api';
import { DollarSign, TrendingUp, BarChart2, PieChart as PieIcon, Users, CreditCard, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';

const currency = (v) => {
  const n = Number(v) || 0;
  return `Rs ${n.toFixed(2)}`;
};

export default function Analysis() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(7);

  // 1. Fetch Data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [salesRes, productsRes, expensesRes, customersRes] = await Promise.all([
          api.get('/sales/'),
          api.get('/products/'),
          api.get('/expenses/'),
          api.get('/customers/')
        ]);

        const getList = (res) => Array.isArray(res.data) ? res.data : (res.data.results || []);

        setSales(getList(salesRes));
        setProducts(getList(productsRes));
        setExpenses(getList(expensesRes));
        setCustomers(getList(customersRes));
      } catch (error) {
        console.error("Analysis load failed", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. Date Range
  const days = useMemo(() => {
    const t = new Date();
    const arr = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(t);
      d.setDate(t.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      arr.push({ iso, label });
    }
    return arr;
  }, [rangeDays]);

  // 3. Product Cost Map (for profit calc)
  const productCostMap = useMemo(() => {
    const map = {};
    products.forEach(p => {
      // Use numeric ID as key, store cost_price
      map[p.id] = Number(p.cost_price || 0);
    });
    return map;
  }, [products]);

  // 4. Advanced Trends (Revenue, COGS, Gross Profit, Expenses)
  const trendData = useMemo(() => {
    const map = {};
    days.forEach((d) => (map[d.iso] = { 
      date: d.label, 
      revenue: 0, 
      cogs: 0, // Cost of Goods Sold
      grossProfit: 0,
      expenses: 0 
    }));

    // Process Sales
    (sales || []).forEach((s) => {
      const iso = new Date(s.date).toISOString().slice(0, 10);
      if (!map[iso]) return;

      // Add Revenue
      map[iso].revenue += Number(s.total_amount || 0);

      // Calculate Cost for this sale
      let saleCost = 0;
      (s.lines || []).forEach(line => {
        // Handle different ID formats (backend might return 'product' ID or object)
        const pId = typeof line.product === 'object' ? line.product.id : line.product;
        const qty = Number(line.quantity || 0);
        const cost = productCostMap[pId] || 0;
        saleCost += (qty * cost);
      });

      map[iso].cogs += saleCost;
      map[iso].grossProfit += (Number(s.total_amount || 0) - saleCost);
    });

    // Process Expenses
    (expenses || []).forEach((ex) => {
      if (!ex || !ex.date) return;
      const iso = new Date(ex.date).toISOString().slice(0, 10);
      if (!map[iso]) return;
      map[iso].expenses += Number(ex.amount || 0);
    });

    return days.map((d) => map[d.iso]);
  }, [days, sales, expenses, productCostMap]);

  // Aggregates
  const totalRevenue = trendData.reduce((s, r) => s + r.revenue, 0);
  const totalCOGS = trendData.reduce((s, r) => s + r.cogs, 0);
  const totalExpenses = trendData.reduce((s, r) => s + r.expenses, 0);
  
  // REAL Profit Definitions
  const totalGrossProfit = totalRevenue - totalCOGS; // Sales - Cost of Products
  const totalNetProfit = totalGrossProfit - totalExpenses; // Gross - Operational Expenses

  // 5. Top Products
  const topProducts = useMemo(() => {
    const agg = {};
    (sales || []).forEach(s => {
      (s.lines || []).forEach(l => {
        const id = l.product || l.product_name || `p-${Math.random()}`;
        if (!agg[id]) agg[id] = { id, name: l.product_name || 'Unknown', qty: 0, revenue: 0 };
        
        const qty = Number(l.quantity || 0);
        const price = Number(l.unit_price || 0);
        
        agg[id].qty += qty;
        agg[id].revenue += qty * price;
      });
    });
    return Object.values(agg).sort((a,b) => b.qty - a.qty).slice(0,5);
  }, [sales]);

  // 6. Expense Breakdown
  const expenseBreakdown = useMemo(() => {
    const map = {};
    (expenses || []).forEach(e => {
      const cat = e.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [expenses]);

  // 7. Top Customers
  const topCustomers = useMemo(() => {
    const custMap = {};
    const customerNameMap = {};
    customers.forEach(c => { customerNameMap[c.id] = c.name; });

    (sales || []).forEach(s => {
      let name = 'Walk-in';
      if (s.customer && customerNameMap[s.customer]) {
        name = customerNameMap[s.customer];
      } else if (s.customer_name) {
        name = s.customer_name;
      }

      if (!custMap[name]) custMap[name] = { name, total: 0 };
      custMap[name].total += Number(s.total_amount || 0);
    });

    return Object.values(custMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales, customers]);

  // 8. Payment Methods
  const paymentStats = useMemo(() => {
    const map = {};
    (sales || []).forEach(s => {
      const method = s.payment_method ? s.payment_method.toLowerCase() : 'cash';
      const label = method.charAt(0).toUpperCase() + method.slice(1);
      map[label] = (map[label] || 0) + Number(s.total_amount || 0);
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [sales]);

  const COLORS = { revenue: '#059669', expenses: '#dc2626', gross: '#0ea5e9', net: '#7c3aed', cogs: '#f59e0b' };
  const pieColors = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4'];

  if (loading) {
    return <div className="analysis-page" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'80vh'}}>Loading Analytics...</div>;
  }

  return (
    <div className="analysis-page">
      <div className="analysis-header">
        <div className="analysis-title">
          <h1>Reports & Analytics</h1>
          <p className="analysis-sub">Financial insights and performance metrics</p>
        </div>

        <div className="analysis-controls">
          <div className="range-buttons">
            <button className={`range-btn ${rangeDays === 7 ? 'active' : ''}`} onClick={() => setRangeDays(7)}>Last 7 Days</button>
            <button className={`range-btn ${rangeDays === 30 ? 'active' : ''}`} onClick={() => setRangeDays(30)}>Last 30 Days</button>
          </div>
        </div>
      </div>

      {/* STAT CARDS - Now with REAL Profit definitions */}
      <div className="analysis-stats-grid">
        <div className="stat-card" style={{ '--card-color': COLORS.revenue }}>
          <div className="stat-icon" style={{ background: COLORS.revenue }}><DollarSign color="#fff" /></div>
          <div className="stat-body">
            <div className="stat-title">Total Revenue</div>
            <div className="stat-amount">{currency(totalRevenue)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--card-color': COLORS.cogs }}>
          <div className="stat-icon" style={{ background: COLORS.cogs }}><Activity color="#fff" /></div>
          <div className="stat-body">
            <div className="stat-title">Cost of Goods</div>
            <div className="stat-amount">{currency(totalCOGS)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--card-color': COLORS.gross }}>
          <div className="stat-icon" style={{ background: COLORS.gross }}><TrendingUp color="#fff" /></div>
          <div className="stat-body">
            <div className="stat-title">Gross Profit</div>
            <div className="stat-amount">{currency(totalGrossProfit)}</div>
            <div className="stat-sub">Sales - Product Cost</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--card-color': COLORS.net }}>
          <div className="stat-icon" style={{ background: COLORS.net }}><BarChart2 color="#fff" /></div>
          <div className="stat-body">
            <div className="stat-title">Net Profit</div>
            <div className="stat-amount">{currency(totalNetProfit)}</div>
            <div className="stat-sub">Gross - Expenses</div>
          </div>
        </div>
      </div>

      {/* NEW: Gross Profit Graph (Sales - Cost) */}
      <div className="card large-chart-card">
        <h3 className="card-title">Gross Profit Trend (Sales - Product Cost)</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.gross} stopOpacity={0.2}/>
                  <stop offset="100%" stopColor={COLORS.gross} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6"/>
              <XAxis dataKey="date" axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip formatter={(val) => currency(val)} />
              <Area type="monotone" dataKey="grossProfit" stroke={COLORS.gross} fill="url(#gGross)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="card large-chart-card" style={{marginTop: '24px'}}>
        <h3 className="card-title">Revenue vs Expenses</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="gRe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.revenue} stopOpacity={0.14}/>
                  <stop offset="100%" stopColor={COLORS.revenue} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gEx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.expenses} stopOpacity={0.12}/>
                  <stop offset="100%" stopColor={COLORS.expenses} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6"/>
              <XAxis dataKey="date" axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip formatter={(val) => currency(val)} />
              <Area type="monotone" dataKey="revenue" stroke={COLORS.revenue} fill="url(#gRe)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke={COLORS.expenses} fill="url(#gEx)" strokeWidth={2} />
              <Legend verticalAlign="top" height={28}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Top Products, Top Customers, Payment Methods */}
      <div className="analysis-bottom-grid" style={{marginTop: '24px'}}>
        
        {/* TOP PRODUCTS (Qty) */}
        <div className="card list-card">
          <h3 className="card-title">Top 5 Products</h3>
          <div className="card-content">
            {topProducts.length === 0 ? <div className="empty">No data</div> : (
              <ul className="top-products">
                {topProducts.map((p, i) => (
                  <li key={p.id} className="product-row">
                    <div className="prod-left">
                      <div className="prod-rank">{i + 1}</div>
                      <div>
                        <div className="prod-name">{p.name}</div>
                        <div className="prod-meta">{p.qty} sold</div>
                      </div>
                    </div>
                    <div className="prod-right">{currency(p.revenue)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* TOP CUSTOMERS (Revenue) */}
        <div className="card list-card">
          <h3 className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <Users size={18}/> Top 5 Customers
          </h3>
          <div className="card-content">
            {Object.keys(topCustomers).length === 0 ? <div className="empty">No sales data</div> : (
              <div className="chart-wrap small">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topCustomers} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6"/>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} interval={0}/>
                    <Tooltip formatter={(v) => currency(v)} cursor={{fill: '#f3f4f6'}} />
                    <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT METHODS */}
        <div className="card list-card">
          <h3 className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <CreditCard size={18}/> Payments
          </h3>
          <div className="card-content">
            {paymentStats.length === 0 ? <div className="empty">No payment data</div> : (
              <div className="pie-wrap small">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={paymentStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {paymentStats.map((entry, idx) => <Cell key={idx} fill={pieColors[idx % pieColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => currency(v)} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}