// src/pages/Analysis.jsx
import React, { useMemo, useState } from 'react';
import '../styles/analysis.css';
import { useData } from '../contexts/DataContext';
import { DollarSign, TrendingUp, BarChart2, PieChart as PieIcon } from 'lucide-react';
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
  Legend
} from 'recharts';

const currency = (v) => {
  const n = Number(v) || 0;
  return `Rs ${n.toFixed(2)}`;
};

export default function Analysis() {
  const { sales = [], products = [], expenses = [] } = useData() || {};
  const [rangeDays, setRangeDays] = useState(7);

  // build last N days
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

  const trendData = useMemo(() => {
    const map = {};
    days.forEach((d) => (map[d.iso] = { date: d.label, revenue: 0, expenses: 0 }));
    (sales || []).forEach((s) => {
      const iso = new Date(s.date).toISOString().slice(0, 10);
      if (!map[iso]) return;
      map[iso].revenue += Number(s.totalAmount || s.total || 0);
    });
    (expenses || []).forEach((ex) => {
      if (!ex || !ex.date) return;
      const iso = new Date(ex.date).toISOString().slice(0, 10);
      if (!map[iso]) return;
      map[iso].expenses += Number(ex.amount || ex.total || 0);
    });
    return days.map((d) => map[d.iso]);
  }, [days, sales, expenses]);

  const totalRevenue = trendData.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalExpenses = trendData.reduce((s, r) => s + (Number(r.expenses) || 0), 0);
  const grossProfit = totalRevenue;
  const netProfit = totalRevenue - totalExpenses;

  // Top products
  const topProducts = useMemo(() => {
    const agg = {};
    (sales || []).forEach(s => {
      (s.lines || []).forEach(l => {
        const id = l.productId || l.productName || `p-${Math.random()}`;
        if (!agg[id]) agg[id] = { id, name: l.productName || 'Unknown', qty: 0, revenue: 0 };
        const qty = Number(l.quantity || 0);
        const price = Number(l.unitPrice || 0);
        agg[id].qty += qty;
        agg[id].revenue += qty * price;
      });
    });
    return Object.values(agg).sort((a,b) => b.qty - a.qty).slice(0,5);
  }, [sales]);

  const expenseBreakdown = useMemo(() => {
    const map = {};
    (expenses || []).forEach(e => {
      const cat = e.category || 'Uncategorized';
      map[cat] = (map[cat] || 0) + Number(e.amount || e.total || 0);
    });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [expenses]);

  // TOP CATEGORIES (by units sold) — uses products to resolve category
  const topCategories = useMemo(() => {
    const prodToCat = {};
    (products || []).forEach(p => prodToCat[p.id] = p.category || 'Uncategorized');

    const catMap = {};
    (sales || []).forEach(s => {
      (s.lines || []).forEach(l => {
        const cat = prodToCat[l.productId] || l.category || 'Uncategorized';
        const qty = Number(l.quantity || 0);
        catMap[cat] = (catMap[cat] || 0) + qty;
      });
    });

    const arr = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));
    return arr.sort((a,b) => b.value - a.value).slice(0,5);
  }, [sales, products]);

  const COLORS = { revenue: '#059669', expenses: '#dc2626', gross: '#0ea5e9', net: '#7c3aed' };
  const pieColors = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#06b6d4'];

  return (
    <div className="analysis-page">
      <div className="analysis-header">
        <div className="analysis-title">
          <h1>Reports & Analytics</h1>
          <p className="analysis-sub">Financial insights and performance metrics</p>
        </div>

        <div className="analysis-controls">
          <div className="range-buttons" role="tablist" aria-label="date range">
            <button className={`range-btn ${rangeDays === 7 ? 'active' : ''}`} onClick={() => setRangeDays(7)}>Last 7 Days</button>
            <button className={`range-btn ${rangeDays === 30 ? 'active' : ''}`} onClick={() => setRangeDays(30)}>Last 30 Days</button>
          </div>
        </div>
      </div>

      <div className="analysis-stats-grid">
        <div className="stat-card" style={{ ['--card-color']: COLORS.revenue }}>
          <div className="stat-icon" style={{ background: COLORS.revenue }}>
            <DollarSign color="#fff" />
          </div>
          <div className="stat-body">
            <div className="stat-title">Total Revenue</div>
            <div className="stat-amount">{currency(totalRevenue)}</div>
            <div className="stat-sub">transactions within range</div>
          </div>
        </div>

        <div className="stat-card" style={{ ['--card-color']: COLORS.expenses }}>
          <div className="stat-icon" style={{ background: COLORS.expenses }}>
            <PieIcon color="#fff" />
          </div>
          <div className="stat-body">
            <div className="stat-title">Total Expenses</div>
            <div className="stat-amount">{currency(totalExpenses)}</div>
            <div className="stat-sub">tracked expenses</div>
          </div>
        </div>

        <div className="stat-card" style={{ ['--card-color']: COLORS.gross }}>
          <div className="stat-icon" style={{ background: COLORS.gross }}>
            <TrendingUp color="#fff" />
          </div>
          <div className="stat-body">
            <div className="stat-title">Gross Profit</div>
            <div className="stat-amount">{currency(grossProfit)}</div>
            <div className="stat-sub">Revenue − COGS</div>
          </div>
        </div>

        <div className="stat-card" style={{ ['--card-color']: COLORS.net }}>
          <div className="stat-icon" style={{ background: COLORS.net }}>
            <BarChart2 color="#fff" />
          </div>
          <div className="stat-body">
            <div className="stat-title">Net Profit</div>
            <div className="stat-amount">{currency(netProfit)}</div>
            <div className="stat-sub">after expenses</div>
          </div>
        </div>
      </div>

      <div className="card large-chart-card">
        <h3 className="card-title">Revenue & Expenses Trend</h3>
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
              <XAxis dataKey="date" axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} tickMargin={10} />
              <YAxis axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip formatter={(val) => currency(val)} />
              <Area type="monotone" dataKey="revenue" stroke={COLORS.revenue} fill="url(#gRe)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke={COLORS.expenses} fill="url(#gEx)" strokeWidth={2} />
              <Legend verticalAlign="top" height={28}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card profit-card">
        <h3 className="card-title">Profit Trend</h3>
        <div className="chart-wrap small">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={trendData.map((d) => ({ date: d.date, profit: (Number(d.revenue) || 0) - (Number(d.expenses) || 0) }))}
              margin={{ top: 8, right: 18, left: 0, bottom: 6 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6"/>
              <XAxis dataKey="date" axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} tickMargin={8} />
              <YAxis axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip formatter={(v) => currency(v)} />
              <Line type="monotone" dataKey="profit" stroke={COLORS.net} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analysis-bottom-grid">
        <div className="card list-card">
          <h3 className="card-title">Top 5 Selling Products</h3>
          <div className="card-content">
            {topProducts.length === 0 ? (
              <div className="empty">No sales data available</div>
            ) : (
              <ul className="top-products">
                {topProducts.map((p, i) => (
                  <li key={p.id} className="product-row">
                    <div className="prod-left">
                      <div className="prod-rank">{i + 1}</div>
                      <div>
                        <div className="prod-name">{p.name}</div>
                        <div className="prod-meta">{p.qty} sold • {currency(p.revenue)}</div>
                      </div>
                    </div>
                    <div className="prod-right">{currency(p.revenue)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card list-card">
          <h3 className="card-title">Expense Breakdown by Category</h3>
          <div className="card-content">
            {expenseBreakdown.length === 0 ? (
              <div className="empty">No expense data available</div>
            ) : (
              <div className="pie-wrap small">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={6}>
                      {expenseBreakdown.map((entry, idx) => <Cell key={idx} fill={pieColors[idx % pieColors.length]} />)}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36}/>
                    <Tooltip formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL WIDTH LARGE PIE (Top categories) */}
      <div className="card top-categories-card">
        <h3 className="card-title">Top 5 Selling Categories (by units)</h3>
        <div className="top-categories-wrap">
          {topCategories.length === 0 ? (
            <div className="empty">No category sales data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <PieChart>
                <Pie
                  data={topCategories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={160}
                  paddingAngle={6}
                  label={({ name, percent }) => `${name} (${Math.round(percent * 100)}%)`}
                >
                  {topCategories.map((entry, idx) => <Cell key={`c-${idx}`} fill={pieColors[idx % pieColors.length]} />)}
                </Pie>
                <Legend verticalAlign="bottom" height={48} />
                <Tooltip formatter={(v) => `${v} units`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card sales-history-card">
        <div className="card-title">Recent Sales</div>
        <div className="card-content">
          {(!sales || sales.length === 0) ? (
            <div className="empty">No sales recorded yet</div>
          ) : (
            <div className="recent-sales-list">
              {sales.slice(-8).reverse().map((s) => (
                <div className="recent-sale-row" key={s.id || s.pk}>
                  <div className="rs-left">
                    <div className="rs-id">#{(s.id || '').toString().slice(-6) || 'N/A'}</div>
                    <div className="rs-meta">{new Date(s.date).toLocaleString()} • {(s.customerName || 'Walk-in')}</div>
                  </div>
                  <div className="rs-right">{currency(s.totalAmount || s.total || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
