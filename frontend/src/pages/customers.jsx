// src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../styles/customers.css';
import { useAuth } from '../contexts/AuthContext';
import api from '../api'; 
import {
  Plus,
  Search,
  User,
  Edit2,
  Trash2,
  DollarSign,
  FileClock,
  X,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

// --- Helpers ---

function StatCard({ title, value, colorClass }) {
  return (
    <div className={`cu-stat-card ${colorClass || ''}`}>
      <div className="cu-stat-title">{title}</div>
      <div className="cu-stat-value">{value}</div>
    </div>
  );
}

const fmtMoney = (amount) => `₨ ${Number(amount || 0).toFixed(2)}`;

// --- NEW: History Modal ---
function HistoryModal({ open, customer, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setLoading(true);
      
      // Fetch both Sales and Payments in parallel
      Promise.all([
        api.get(`/sales/?customer=${customer.id}`),
        api.get(`/customer-payments/?customer=${customer.id}`)
      ])
      .then(([salesRes, paymentsRes]) => {
        const sales = Array.isArray(salesRes.data) ? salesRes.data : salesRes.data.results || [];
        const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : paymentsRes.data.results || [];

        // Normalize Data for Unified List
        const unified = [
          ...sales.map(s => ({
            id: `sale-${s.id}`,
            date: s.date,
            type: 'sale',
            amount: Number(s.total_amount),
            desc: `Sale #${s.sale_no || s.id}`,
            is_credit: s.is_credit,
            ref: s.payment_method
          })),
          ...payments.map(p => ({
            id: `pay-${p.id}`,
            date: p.payment_date,
            type: 'payment',
            amount: Number(p.amount),
            desc: 'Payment Received',
            is_credit: false,
            ref: p.reference || p.payment_method
          }))
        ];

        // Sort descending by date
        unified.sort((a, b) => new Date(b.date) - new Date(a.date));
        setHistory(unified);
      })
      .catch(err => console.error("History fetch error", err))
      .finally(() => setLoading(false));
    }
  }, [open, customer]);

  if (!open || !customer) return null;

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <header className="cu-modal-header">
          <h3>Transaction History — {customer.name}</h3>
          <button className="cu-close" onClick={onClose}><X size={24}/></button>
        </header>
        <div className="cu-modal-body">
          {loading ? <div className="cu-empty">Loading records...</div> : 
           history.length === 0 ? <div className="cu-empty">No transaction history found.</div> : (
            <div className="cu-table-wrap">
              <table className="cu-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th style={{textAlign: 'right'}}>Debit (+)</th>
                    <th style={{textAlign: 'right'}}>Credit (-)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => {
                    const isSale = item.type === 'sale';
                    return (
                      <tr key={item.id}>
                        <td style={{fontSize: '0.9rem'}}>{new Date(item.date).toLocaleString()}</td>
                        <td>
                          {isSale ? (
                            <span className="cu-status" style={{background:'#e0e7ff', color:'#4338ca'}}>
                              <ArrowUpRight size={12} style={{marginRight:4}}/> Bill
                            </span>
                          ) : (
                            <span className="cu-status" style={{background:'#ecfdf5', color:'#047857'}}>
                              <ArrowDownLeft size={12} style={{marginRight:4}}/> Payment
                            </span>
                          )}
                        </td>
                        <td style={{fontSize: '0.9rem', color: '#6b7280'}}>
                          {item.desc} {item.ref ? `(${item.ref})` : ''}
                        </td>
                        {/* Sale increases debt (Debit), Payment decreases debt (Credit) */}
                        <td style={{textAlign: 'right', fontWeight: isSale ? 600 : 400}}>
                          {isSale ? fmtMoney(item.amount) : '-'}
                        </td>
                        <td style={{textAlign: 'right', fontWeight: !isSale ? 600 : 400, color: !isSale ? '#059669' : 'inherit'}}>
                          {!isSale ? fmtMoney(item.amount) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer className="cu-modal-footer">
          <button className="cu-btn cu-btn-secondary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

// --- Customer Modal ---
function CustomerModal({ open, customer = null, onClose, onSave, isAdmin }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', credit_limit: '' });

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        notes: customer.notes || '',
        credit_limit: customer.credited_amount ?? '',
      });
    } else {
      setForm({ name: '', phone: '', email: '', notes: '', credit_limit: '' });
    }
  }, [customer, open]);

  if (!open) return null;

  function save() {
    if (!form.name) return alert('Name is required.');
    const payload = { ...form };
    if (isAdmin) payload.credited_amount = form.credit_limit ? Number(form.credit_limit) : 0;
    onSave(payload);
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <header className="cu-modal-header">
          <h3>{customer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button className="cu-close" onClick={onClose}><X size={24}/></button>
        </header>
        <div className="cu-modal-body">
          <label className="cu-field">
            <div className="cu-field-label">Full Name</div>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Customer Name" />
          </label>
          <div className="cu-row">
            <label className="cu-field">
              <div className="cu-field-label">Phone</div>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone Number" />
            </label>
            <label className="cu-field">
              <div className="cu-field-label">Email</div>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email (Optional)" />
            </label>
          </div>
          <label className="cu-field">
            <div className="cu-field-label">Notes</div>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes" />
          </label>
          {isAdmin && (
            <div className="cu-row">
              <label className="cu-field">
                <div className="cu-field-label">Credited Amount (Debt)</div>
                <input type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} min="0" step="0.01" />
              </label>
            </div>
          )}
        </div>
        <footer className="cu-modal-footer">
          <button className="cu-btn cu-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="cu-btn cu-btn-primary" onClick={save}>{customer ? 'Save Changes' : 'Create Customer'}</button>
        </footer>
      </div>
    </div>
  );
}

// --- Payment Modal ---
function PaymentModal({ open, customer, onClose, onRecordPayment }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('Cash');

  useEffect(() => {
    if (customer) { setAmount(''); setNote(''); setMethod('Cash'); }
  }, [customer, open]);

  if (!open || !customer) return null;

  function record() {
    const val = Number(amount);
    if (!val || val <= 0) return alert('Enter valid amount');
    onRecordPayment({ customerId: customer.id, amount: val, note, method });
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <header className="cu-modal-header">
          <h3>Record Payment — {customer.name}</h3>
          <button className="cu-close" onClick={onClose}><X size={24}/></button>
        </header>
        <div className="cu-modal-body">
          <div className="cu-field">
            <div className="cu-field-label">Amount Paid</div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div className="cu-field">
            <div className="cu-field-label">Payment Method</div>
            <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div className="cu-field">
            <div className="cu-field-label">Reference / Note</div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
        <footer className="cu-modal-footer">
          <button className="cu-btn cu-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="cu-btn cu-btn-primary" onClick={record}>Confirm Payment</button>
        </footer>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function CustomersPage() {
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/customers/');
      setCustomers(Array.isArray(resp.data) ? resp.data : resp.data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(customers); return; }
    setFiltered(customers.filter(c => 
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    ));
  }, [search, customers]);

  const stats = useMemo(() => {
    const total = customers.length;
    const withCredit = customers.filter(c => Number(c.credited_amount) > 0).length;
    const totalCredited = customers.reduce((s, c) => s + Number(c.credited_amount || 0), 0);
    return { total, withCredit, totalCredited };
  }, [customers]);

  const handleSaveCustomer = async (payload) => {
    try {
      if (selected?.id) await api.patch(`/customers/${selected.id}/`, payload);
      else await api.post('/customers/', payload);
      loadCustomers(); setEditOpen(false);
    } catch (e) { alert("Save failed"); }
  };

  const handleDeleteCustomer = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    try { await api.delete(`/customers/${c.id}/`); loadCustomers(); } 
    catch (e) { alert("Delete failed"); }
  };

  const handleRecordPayment = async ({ customerId, amount, note, method }) => {
    try {
      // Use the NEW endpoint
      await api.post('/customer-payments/', { 
        customer: customerId, 
        amount: amount, 
        notes: note, 
        payment_method: method 
      });
      alert("Payment recorded!");
      loadCustomers(); setPayOpen(false);
    } catch (e) {
      alert("Payment failed: " + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="cu-page">
      <div className="cu-header">
        <div>
          <h2>Customer Management</h2>
          <p className="cu-sub">Manage customers and credit history</p>
        </div>
        <button className="cu-btn cu-btn-primary" onClick={() => { setSelected(null); setEditOpen(true); }}>
          <Plus size={16}/> Add Customer
        </button>
      </div>

      <div className="cu-stats-row">
        <StatCard title="Total Customers" value={stats.total} colorClass="c-blue" />
        <StatCard title="Debtors" value={stats.withCredit} colorClass="c-orange" />
        {isAdmin && <StatCard title="Total Outstanding" value={fmtMoney(stats.totalCredited)} colorClass="c-red" />}
      </div>

      <div className="cu-search-row">
        <div className="cu-search">
          <Search size={18} className="cu-search-icon" />
          <input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="cu-table-card">
        <div className="cu-table-header">
          <div className="cu-table-title"><User size={16}/> Customer List</div>
        </div>
        <div className="cu-table-wrap">
          <table className="cu-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Outstanding Credit</th>
                <th>Status</th>
                <th className="cu-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="cu-empty">Loading...</td></tr> : filtered.map(c => {
                const credit = Number(c.credited_amount || 0);
                return (
                  <tr key={c.id} onClick={() => { setSelected(c); setHistoryOpen(true); }} style={{cursor:'pointer'}}>
                    <td className="cu-name">{c.name}</td>
                    <td>{c.phone || '-'}</td>
                    <td className={credit > 0 ? 'cu-out-red' : ''}>{fmtMoney(credit)}</td>
                    <td><span className={`cu-status ${credit > 0 ? 'warn' : 'clear'}`}>{credit > 0 ? 'Has Debt' : 'Clear'}</span></td>
                    <td className="cu-actions-col" onClick={e => e.stopPropagation()}>
                      <button className="icon-btn" title="History" onClick={() => { setSelected(c); setHistoryOpen(true); }}><FileClock size={16}/></button>
                      <button className="icon-btn" title="Pay" onClick={() => { setSelected(c); setPayOpen(true); }}><DollarSign size={16}/></button>
                      <button className="icon-btn" title="Edit" onClick={() => { setSelected(c); setEditOpen(true); }}><Edit2 size={16}/></button>
                      {isAdmin && <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteCustomer(c)}><Trash2 size={16}/></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerModal open={editOpen} customer={selected} onClose={() => setEditOpen(false)} onSave={handleSaveCustomer} isAdmin={isAdmin} />
      <PaymentModal open={payOpen} customer={selected} onClose={() => setPayOpen(false)} onRecordPayment={handleRecordPayment} />
      <HistoryModal open={historyOpen} customer={selected} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}