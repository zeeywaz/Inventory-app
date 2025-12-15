// src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../styles/customers.css';
import { useAuth } from '../contexts/AuthContext';
import api from '../api'; // axios client with baseURL + auth interceptors
import {
  Plus,
  Search,
  User,
  Edit2,
  Trash2,
  DollarSign,
} from 'lucide-react';

/**
 * Customers page (direct backend calls)
 * - Uses only `credited_amount` (no `outstanding`)
 * - Recording a payment reduces credited_amount (clamped to >= 0)
 *
 * Backend expectations:
 * - GET /customers/ (list)
 * - POST /customers/ (create)
 * - PATCH /customers/:id/ (update)
 * - DELETE /customers/:id/ (delete)
 * Optional (preferred): POST /customers/:id/payments/ or POST /customer-payments/
 * If payments endpoints exist they will be used; otherwise this file PATCHes the customer's credited_amount.
 */

function StatCard({ title, value, colorClass }) {
  return (
    <div className={`cu-stat-card ${colorClass || ''}`}>
      <div className="cu-stat-title">{title}</div>
      <div className="cu-stat-value">{value}</div>
    </div>
  );
}

function CustomerModal({ open, customer = null, onClose, onSave, isAdmin }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    credit_limit: '', // will be sent as credited_amount
  });

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

  function updateField(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

  function save() {
    if (!form.name) return alert('Name is required.');
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    };
    // map credit_limit -> credited_amount (DB column)
    if (isAdmin) {
      payload.credited_amount = form.credit_limit ? Number(form.credit_limit) : 0;
    }
    onSave(payload);
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cu-modal-header">
          <h3>{customer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button className="cu-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="cu-modal-body">
          <label className="cu-field">
            <div className="cu-field-label">Full name</div>
            <input value={form.name} onChange={updateField('name')} placeholder="John Doe" />
          </label>

          <div className="cu-row">
            <label className="cu-field">
              <div className="cu-field-label">Phone</div>
              <input value={form.phone} onChange={updateField('phone')} placeholder="+1 555 555 555" />
            </label>
            <label className="cu-field">
              <div className="cu-field-label">Email</div>
              <input value={form.email} onChange={updateField('email')} placeholder="name@email.com" />
            </label>
          </div>

          <label className="cu-field">
            <div className="cu-field-label">Notes</div>
            <input value={form.notes} onChange={updateField('notes')} placeholder="Optional notes" />
          </label>

          {isAdmin && (
            <div className="cu-row">
              <label className="cu-field">
                <div className="cu-field-label">Credited amount</div>
                <input
                  type="number"
                  value={form.credit_limit}
                  onChange={updateField('credit_limit')}
                  min="0"
                  step="0.01"
                />
              </label>
            </div>
          )}
        </div>

        <footer className="cu-modal-footer">
          <button className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{customer ? 'Save' : 'Add customer'}</button>
        </footer>
      </div>
    </div>
  );
}

function PaymentModal({ open, customer, onClose, onRecordPayment }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (customer) setAmount('');
    setNote('');
  }, [customer, open]);

  if (!open || !customer) return null;

  function record() {
    const val = Number(amount || 0);
    if (!val || val <= 0) return alert('Enter a valid amount.');
    onRecordPayment({ customerId: customer.id, amount: val, note });
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cu-modal-header">
          <h3>Record Payment — {customer.name}</h3>
          <button className="cu-close" onClick={onClose}>✕</button>
        </header>

        <div className="cu-modal-body">
          <div className="cu-field">
            <div className="cu-field-label">Amount</div>
            <div className="cu-amount-row">
              <span className="cu-currency">Rs </span>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="cu-field">
            <div className="cu-field-label">Note (optional)</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment reference / cash / card ..." />
          </div>
        </div>

        <footer className="cu-modal-footer">
          <button className="btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={record}>Record Payment</button>
        </footer>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth() || {};
  const role = user?.role || 'staff';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  // load customers
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/customers/');
      const data = Array.isArray(resp.data) ? resp.data : (resp.data.results ?? resp.data.data ?? []);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers', err);
      alert('Could not fetch customers. Check backend and CORS. ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, []);

  useEffect(() => setFiltered(customers || []), [customers]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(customers); return; }
    const res = (customers || []).filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
    setFiltered(res);
  }, [search, customers]);

  const stats = useMemo(() => {
    const total = (customers || []).length;
    const withCredit = (customers || []).filter(c => (Number(c.credited_amount) || 0) > 0).length;
    const totalCredited = (customers || []).reduce((s, c) => s + (Number(c.credited_amount) || 0), 0);
    return { total, withCredit, totalCredited };
  }, [customers]);

  function openAdd() { setSelected(null); setEditOpen(true); }
  function openEdit(c) { setSelected(c); setEditOpen(true); }
  function openPay(c) { setSelected(c); setPayOpen(true); }

  // create
  async function createCustomer(payload) {
    try {
      const resp = await api.post('/customers/', payload);
      setCustomers(prev => [resp.data, ...prev]);
      return resp.data;
    } catch (err) {
      console.error('createCustomer error', err);
      throw err;
    }
  }

  // update
  async function updateCustomer(id, patch) {
    try {
      const resp = await api.patch(`/customers/${id}/`, patch);
      const updated = resp.data;
      setCustomers(prev => prev.map(c => String(c.id) === String(id) ? updated : c));
      return updated;
    } catch (err) {
      console.error('updateCustomer error', err);
      throw err;
    }
  }

  // delete
  async function deleteCustomer(id) {
    try {
      await api.delete(`/customers/${id}/`);
      setCustomers(prev => prev.filter(c => String(c.id) !== String(id)));
      return true;
    } catch (err) {
      console.error('deleteCustomer error', err);
      throw err;
    }
  }

  /**
   * recordPayment reduces credited_amount by `amount`.
   * Strategy:
   * 1) Try POST /customers/:id/payments/ (preferred)
   * 2) Try POST /customer-payments/ (global)
   * 3) Fallback: PATCH /customers/:id/ with credited_amount = max(0, current - amount)
   */
  async function recordPayment({ customerId, amount, note }) {
    if (!customerId) throw new Error('Missing customerId');
    if (!amount || Number(amount) <= 0) throw new Error('Invalid amount');

    const existing = customers.find(c => String(c.id) === String(customerId)) || {};
    const currentCredited = Number(existing.credited_amount || 0);
    const newCredited = Math.max(0, +(currentCredited - Number(amount)).toFixed(2));

    // 1) nested payments endpoint
    try {
      const resp = await api.post(`/customers/${customerId}/payments/`, { amount, note });
      // If server returns updated customer, use it; otherwise reload customer list
      if (resp.data?.customer) {
        setCustomers(prev => prev.map(c => String(c.id) === String(customerId) ? resp.data.customer : c));
      } else {
        await loadCustomers();
      }
      return resp.data;
    } catch (err) {
      console.warn('nested payments endpoint failed or not available', err?.response?.status);
    }

    // 2) global payments endpoint
    try {
      const resp = await api.post(`/customer-payments/`, { customer: customerId, amount, note });
      if (resp.data?.customer) {
        setCustomers(prev => prev.map(c => String(c.id) === String(customerId) ? resp.data.customer : c));
      } else {
        await loadCustomers();
      }
      return resp.data;
    } catch (err) {
      console.warn('global customer-payments endpoint failed or not available', err?.response?.status);
    }

    // 3) fallback: patch credited_amount
    try {
      const resp = await api.patch(`/customers/${customerId}/`, { credited_amount: newCredited });
      setCustomers(prev => prev.map(c => String(c.id) === String(customerId) ? resp.data : c));
      return resp.data;
    } catch (err) {
      console.error('recordPayment fallback (patch credited_amount) failed', err);
      throw new Error(
        `Recording payment failed. Server needs a payments endpoint (POST /customers/:id/payments/ or POST /customer-payments/) or allow PATCH on credited_amount.`
      );
    }
  }

  // Handlers used by UI
  async function handleSaveCustomer(payload) {
    try {
      if (selected && selected.id) {
        if (!isAdmin) return alert('Only admins can edit customer credit information.');
        await updateCustomer(selected.id, payload);
        alert('Customer saved');
      } else {
        await createCustomer(payload);
        alert('Customer added');
      }
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + (err?.response?.data?.detail || err.message || String(err)));
    }
  }

  async function handleDeleteCustomer(c) {
    if (!isAdmin) return alert('Only admins can delete customers.');
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    try {
      await deleteCustomer(c.id);
      alert('Deleted');
    } catch (err) {
      console.error(err);
      alert('Delete failed: ' + (err?.response?.data || err.message || String(err)));
    }
  }

  async function handleRecordPayment({ customerId, amount, note }) {
    try {
      await recordPayment({ customerId, amount, note });
      alert('Payment recorded — credited amount reduced');
      setPayOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Payment failed. Check backend support for payments or credited_amount patching.');
    }
  }

  // render list
  return (
    <div className="cu-page">
      <div className="cu-header">
        <div>
          <h2>Customer Management</h2>
          <p className="cu-sub">Manage customers and credit accounts</p>
        </div>

        <div className="cu-actions">
          <button className="btn btn-primary" onClick={() => openAdd()}><Plus size={14} /> Add Customer</button>
        </div>
      </div>

      <div className="cu-stats-row">
        <StatCard title="Total Customers" value={stats.total} colorClass="c-blue" />
        <StatCard title="Customers with Credit" value={stats.withCredit} colorClass="c-orange" />
        {isAdmin && <StatCard title="Total Credited" value={`Rs ${stats.totalCredited.toFixed(2)}`} colorClass="c-red" />}
      </div>

      <div className="cu-search-row">
        <div className="cu-search">
          <Search size={18} className="cu-search-icon" />
          <input placeholder="Search name, phone or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="cu-table card">
        <div className="cu-table-header">
          <div className="cu-table-title"><User size={16} /> Customer List ({filtered.length})</div>
        </div>

        <div className="cu-table-wrap">
          <table className="cu-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Credited amount</th>
                <th>Status</th>
                <th className="cu-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && <tr><td colSpan="6">Loading…</td></tr>}
              {filtered.map((c) => {
                const credited = Number(c.credited_amount || 0);
                const status = credited > 0 ? 'Has credit' : 'Clear';
                return (
                  <tr key={c.id}>
                    <td className="cu-name">{c.name}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{isAdmin ? `₨ ${credited.toFixed(2)}` : (credited > 0 ? 'Has credit' : '—')}</td>
                    <td><span className={`cu-status ${credited > 0 ? 'warn' : 'clear'}`}>{status}</span></td>
                    <td className="cu-actions-col">
                      <button className="icon-btn" title="View / Edit" onClick={() => openEdit(c)}><Edit2 size={16} /></button>
                      <button className="icon-btn" title="Record Payment" onClick={() => openPay(c)}><DollarSign size={16} /></button>
                      {isAdmin ? <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteCustomer(c)}><Trash2 size={16} /></button> : null}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !loading && (
                <tr><td colSpan="6" className="cu-empty">No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerModal open={editOpen} customer={selected} onClose={() => setEditOpen(false)} onSave={handleSaveCustomer} isAdmin={isAdmin} />
      <PaymentModal open={payOpen} customer={selected} onClose={() => setPayOpen(false)} onRecordPayment={handleRecordPayment} />
    </div>
  );
}
