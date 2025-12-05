// src/pages/suppliers.jsx
import React, { useState, useMemo, useEffect } from 'react';
import '../styles/suppliers.css';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { Plus, Truck, Edit2, Trash2, Search } from 'lucide-react';

// NEW: Currency formatting helper
const formatCurrency = (amount) =>
  `₨${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Suppliers() {
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // supplier being edited or null
  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load suppliers & purchase orders from backend
  async function loadSuppliers() {
    try {
      const resp = await api.get('/suppliers/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setSuppliers(raw);
    } catch (err) {
      console.error('Failed to load suppliers', err);
      alert('Could not load suppliers. Check backend/CORS. ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  async function loadPurchaseOrders() {
    try {
      const resp = await api.get('/purchase-orders/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setPurchaseOrders(raw);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
      // no alert — optional
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadSuppliers(), loadPurchaseOrders()]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Compute outstanding per supplier (robust to different PO shapes)
  const supplierOutstanding = useMemo(() => {
    const outstandingMap = new Map();
    (purchaseOrders || []).forEach((po) => {
      const total = Number(po.total_amount ?? po.total ?? 0);
      const paid = Number(po.amount_paid ?? po.paid ?? 0);
      const balance = Math.max(0, total - paid);

      if (balance <= 0) return;

      const status = (po.status || '').toString().toLowerCase();
      if (status === 'cancelled') return;

      const supplierId =
        (typeof po.supplier === 'number' && po.supplier) ||
        po.supplier_id ||
        (po.supplier && (po.supplier.id || po.supplier.pk)) ||
        null;

      if (!supplierId) return;

      const current = outstandingMap.get(supplierId) || 0;
      outstandingMap.set(supplierId, current + balance);
    });
    return outstandingMap;
  }, [purchaseOrders]);

  const totalOutstanding = useMemo(() => {
    let t = 0;
    for (const v of supplierOutstanding.values()) t += v;
    return t;
  }, [supplierOutstanding]);

  const totalSuppliers = suppliers.length;

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contact_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
    setModalOpen(true);
  }

  function openEdit(supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || '',
      contact_name: supplier.contact_name || supplier.contact || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setSaving(false);
  }

  function updateField(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Create / update via backend
  async function handleSave(e) {
    e && e.preventDefault();
    if (!form.name || !form.name.trim()) return alert('Supplier name required');

    setSaving(true);
    try {
      if (editing) {
        // PATCH supplier
        const resp = await api.patch(`/suppliers/${editing.id}/`, { ...form });
        const updated = resp.data;
        setSuppliers((prev) => prev.map((s) => (String(s.id) === String(editing.id) ? updated : s)));
        alert('Supplier updated');
      } else {
        // POST new supplier
        const resp = await api.post('/suppliers/', { ...form });
        const created = resp.data;
        setSuppliers((prev) => [created, ...prev]);
        alert('Supplier created');
      }
      closeModal();
    } catch (err) {
      console.error('Save supplier failed', err);
      alert('Save failed: ' + (err?.response?.data || err.message || String(err)));
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier) {
    if (!isAdmin) return alert('Only admins can delete suppliers.');
    if (!window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/suppliers/${supplier.id}/`);
      setSuppliers((prev) => prev.filter((s) => String(s.id) !== String(supplier.id)));
      alert('Supplier deleted');
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed: ' + (err?.response?.data || err.message || String(err)));
    }
  }

  return (
    <div className="sp-page">
      <div className="sp-header">
        <div>
          <h2>Supplier Management</h2>
          <p className="sp-sub">Manage your supplier database</p>
        </div>

        <div className="sp-actions">
          <div className="sp-stats">
            <div className="sp-stat-card c-purple">
              <div className="sp-stat-title">Total Suppliers</div>
              <div className="sp-stat-value">{totalSuppliers}</div>
            </div>
            <div className="sp-stat-card c-red">
              <div className="sp-stat-title">Total Outstanding</div>
              <div className="sp-stat-value">{formatCurrency(totalOutstanding)}</div>
            </div>
          </div>

          {isAdmin ? (
            <button className="btn sp-btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Supplier
            </button>
          ) : (
            <button className="btn sp-btn-muted" onClick={() => alert('Staff cannot add suppliers')} disabled>
              <Plus size={16} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      <div className="sp-search-row">
        <div className="sp-search">
          <Search size={16} className="sp-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers by name, contact, phone or email..."
            aria-label="Search suppliers"
          />
        </div>
      </div>

      <div className="sp-table-card">
        <div className="sp-table-header">
          <div className="sp-table-title"><Truck size={18} /> Supplier List ({visibleList.length})</div>
        </div>

        <div className="sp-table-wrap">
          {loading ? (
            <div className="sp-empty">Loading…</div>
          ) : visibleList.length === 0 ? (
            <div className="sp-empty">No suppliers found</div>
          ) : (
            <table className="sp-table" role="table" aria-label="Supplier list">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th className="sp-align-right">Outstanding Credit</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleList.map((s) => {
                  const outstanding = supplierOutstanding.get(s.id) || 0;
                  return (
                    <tr key={s.id || s.pk}>
                      <td className="sp-prodcol"><span className="sp-prod-name">{s.name}</span></td>
                      <td>{s.contact_name || s.contact || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>{s.email || '—'}</td>
                      <td>{s.address || '—'}</td>
                      <td className={`sp-outstanding ${outstanding > 0 ? 'due' : ''}`}>
                        {formatCurrency(outstanding)}
                      </td>
                      {isAdmin && (
                        <td className="sp-actions-col">
                          <button className="icon-btn" title="Edit" onClick={() => openEdit(s)}><Edit2 size={16} /></button>
                          <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(s)}><Trash2 size={16} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* modal */}
      {modalOpen && (
        <div className="sp-modal-overlay" onClick={closeModal}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3>{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
            </div>

            <div className="sp-modal-body">
              <form id="supplier-form" onSubmit={(e) => { e.preventDefault(); handleSave(e); }}>
                <div className="sp-row">
                  <div className="sp-field">
                    <label className="sp-field-label">Company name</label>
                    <input value={form.name} onChange={updateField('name')} placeholder="Supplier company name" required />
                  </div>
                  <div className="sp-field">
                    <label className="sp-field-label">Contact person</label>
                    <input value={form.contact_name} onChange={updateField('contact_name')} placeholder="Contact name" />
                  </div>
                </div>

                <div className="sp-row">
                  <div className="sp-field">
                    <label className="sp-field-label">Phone</label>
                    <input value={form.phone} onChange={updateField('phone')} placeholder="+1234567890" />
                  </div>
                  <div className="sp-field">
                    <label className="sp-field-label">Email</label>
                    <input type="email" value={form.email} onChange={updateField('email')} placeholder="contact@vendor.com" />
                  </div>
                </div>

                <div className="sp-field">
                  <label className="sp-field-label">Address</label>
                  <input value={form.address} onChange={updateField('address')} placeholder="Street, City, Country" />
                </div>

                <div className="sp-field">
                  <label className="sp-field-label">Notes (optional)</label>
                  <textarea value={form.notes} onChange={updateField('notes')} rows={3} placeholder="Any notes"></textarea>
                </div>
              </form>
            </div>

            <div className="sp-modal-footer">
              <button className="btn sp-btn-muted" onClick={closeModal}>Cancel</button>
              <button className="btn sp-btn-primary" type="submit" form="supplier-form" disabled={saving} style={{ marginLeft: 8 }}>
                {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Supplier')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
