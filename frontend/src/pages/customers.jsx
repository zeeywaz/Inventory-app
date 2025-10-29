import React, { useEffect, useMemo, useState } from 'react';
import '../styles/customers.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Search,
  User,
  Edit2,
  Trash2,
  CreditCard,
  DollarSign,
  UserCheck,
} from 'lucide-react';

/**
 * Customers page
 * - Admin: add/edit/delete, set credit limit & outstanding
 * - Staff: add basic customer, view, record payments (cannot delete, cannot set credit limit)
 */

function StatCard({ title, value, colorClass }) {
  return (
    <div className={`cu-stat-card ${colorClass || ''}`}>
      <div className="cu-stat-title">{title}</div>
      <div className="cu-stat-value">{value}</div>
    </div>
  );
}

/* Modal for add / edit customer */
function CustomerModal({ open, customer = null, onClose, onSave, isAdmin }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    credit_limit: '',
    outstanding: '',
    notes: '',
  });

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        credit_limit: (customer.credit_limit ?? customer.creditLimit ?? '') || '',
        outstanding: (customer.outstanding ?? customer.outstanding_amount ?? '') || '',
        notes: customer.notes || '',
      });
    } else {
      setForm({ name: '', phone: '', email: '', credit_limit: '', outstanding: '', notes: '' });
    }
  }, [customer, open]);

  if (!open) return null;

  function updateField(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function save() {
    if (!form.name) return alert('Name is required.');
    // Staff cannot set credit_limit or outstanding when creating/updating
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    };
    if (isAdmin) {
      payload.credit_limit = Number(form.credit_limit || 0);
      payload.outstanding = Number(form.outstanding || 0);
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
                <div className="cu-field-label">Credit limit</div>
                <input type="number" value={form.credit_limit} onChange={updateField('credit_limit')} min="0" />
              </label>
              <label className="cu-field">
                <div className="cu-field-label">Outstanding</div>
                <input type="number" value={form.outstanding} onChange={updateField('outstanding')} min="0" />
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

/* Modal to record a payment (reduce outstanding). Staff & Admin allowed. */
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
  const { customers = [], createCustomer, updateCustomer, deleteCustomer, recordPayment } = useData() || {};
  const { user } = useAuth() || {};
  const role = user?.role || 'staff';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';

  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState(customers || []);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => setFiltered(customers || []), [customers]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return setFiltered(customers || []);
    const result = (customers || []).filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
    setFiltered(result);
  }, [search, customers]);

  const stats = useMemo(() => {
    const total = (customers || []).length;
    const withCredit = (customers || []).filter(c => (Number(c.credit_limit) || 0) > 0).length;
    const outstanding = (customers || []).reduce((s, c) => s + (Number(c.outstanding) || 0), 0);
    return { total, withCredit, outstanding };
  }, [customers]);

  function openAdd() {
    setSelected(null);
    setEditOpen(true);
  }
  function openEdit(c) {
    setSelected(c);
    setEditOpen(true);
  }
  function openPay(c) {
    setSelected(c);
    setPayOpen(true);
  }

  async function handleSaveCustomer(payload) {
    if (selected && selected.id) {
      // update
      if (typeof updateCustomer === 'function') {
        try {
          await updateCustomer(selected.id, payload);
          alert('Customer saved');
        } catch (err) {
          console.error(err);
          alert('Save failed');
        }
      } else {
        console.log('Update prepared:', selected.id, payload);
        alert('Saved (mock) — implement updateCustomer in DataContext.');
      }
    } else {
      // create
      if (typeof createCustomer === 'function') {
        try {
          await createCustomer(payload);
          alert('Customer added');
        } catch (err) {
          console.error(err);
          alert('Create failed');
        }
      } else {
        console.log('Create prepared:', payload);
        alert('Customer created (mock).');
      }
    }
    setEditOpen(false);
  }

  async function handleDeleteCustomer(c) {
    if (!isAdmin) return alert('Only admins can delete customers.');
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    if (typeof deleteCustomer === 'function') {
      try {
        await deleteCustomer(c.id);
        alert('Deleted');
      } catch (err) {
        console.error(err);
        alert('Delete failed');
      }
    } else {
      console.log('Delete prepared:', c);
      alert('Delete (mock) — implement deleteCustomer in DataContext.');
    }
  }

  async function handleRecordPayment({ customerId, amount, note }) {
    if (typeof recordPayment === 'function') {
      try {
        await recordPayment(customerId, { amount, note });
        alert('Payment recorded');
      } catch (err) {
        console.error(err);
        alert('Payment failed');
      }
    } else {
      // fallback: log and show mock update
      console.log('Record payment prepared:', { customerId, amount, note });
      alert('Payment recorded (mock). Implement recordPayment in DataContext to persist.');
    }
    setPayOpen(false);
  }

  return (
    <div className="cu-page">
      <div className="cu-header">
        <div>
          <h2>Customer Management</h2>
          <p className="cu-sub">Manage customers and credit accounts</p>
        </div>

        <div className="cu-actions">
          {/* Admin can add; staff can also add but with limited fields */}
          <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Customer</button>
        </div>
      </div>

      <div className="cu-stats-row">
        <StatCard title="Total Customers" value={stats.total} colorClass="c-blue" />
        <StatCard title="Customers with Credit" value={stats.withCredit} colorClass="c-orange" />
        <StatCard title="Total Outstanding" value={`Rs ${stats.outstanding.toFixed(2)}`} colorClass="c-red" />
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
                <th>Credit Limit</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th className="cu-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => {
                const outstanding = Number(c.outstanding || 0);
                const limit = Number(c.credit_limit || 0);
                const status = outstanding > 0 ? 'Has outstanding' : 'Clear';
                return (
                  <tr key={c.id}>
                    <td className="cu-name">{c.name}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{isAdmin ? `₨ ${limit.toFixed(2)}` : (limit > 0 ? 'Has credit' : '—')}</td>
                    <td className="cu-outstanding">{outstanding > 0 ? <span className="cu-out-red">₨ {outstanding.toFixed(2)}</span> : '₨ 0.00'}</td>
                    <td><span className={`cu-status ${outstanding > 0 ? 'warn' : 'clear'}`}>{status}</span></td>
                    <td className="cu-actions-col">
                      <button className="icon-btn" title="View / Edit" onClick={() => openEdit(c)}><Edit2 size={16} /></button>
                      <button className="icon-btn" title="Record Payment" onClick={() => openPay(c)}><DollarSign size={16} /></button>
                      {isAdmin ? <button className="icon-btn danger" title="Delete" onClick={() => handleDeleteCustomer(c)}><Trash2 size={16} /></button> : null}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="cu-empty">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* modals */}
      <CustomerModal open={editOpen} customer={selected} onClose={() => setEditOpen(false)} onSave={handleSaveCustomer} isAdmin={isAdmin} />
      <PaymentModal open={payOpen} customer={selected} onClose={() => setPayOpen(false)} onRecordPayment={handleRecordPayment} />
    </div>
  );
}
