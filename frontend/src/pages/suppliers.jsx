// src/pages/suppliers.jsx
import React, { useState, useMemo } from 'react';
import '../styles/suppliers.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Truck, Edit2, Trash2, Search } from 'lucide-react';

export default function Suppliers() {
  const dataCtx = useData() || {};
  const { suppliers = [], addSupplier, updateSupplier, deleteSupplier } = dataCtx;
  const auth = useAuth() || {};
  const user = auth.user || null;
  const isAdmin = user?.role === 'admin';

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // supplier being edited or null
  const [form, setForm] = useState({
    name: '', contact_name: '', phone: '', email: '', address: '', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const totalSuppliers = suppliers.length;

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contact_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  function openAdd() {
    setEditing(null);
    setForm({ name:'', contact_name:'', phone:'', email:'', address:'', notes:'' });
    setModalOpen(true);
  }
  function openEdit(supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || '',
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    });
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setSaving(false);
  }

  function updateField(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e && e.preventDefault();
    if (!form.name.trim()) return alert('Supplier name required');

    setSaving(true);
    try {
      if (editing && typeof updateSupplier === 'function') {
        await updateSupplier(editing.id, { ...form });
        // optimistic UI: contexts typically update
      } else if (!editing && typeof addSupplier === 'function') {
        await addSupplier({ ...form });
      } else {
        // No API functions available — just log
        console.log('Save supplier (mock):', form);
      }
      closeModal();
    } catch (err) {
      console.error('Save supplier failed', err);
      alert('Save failed — check console');
      setSaving(false);
    }
  }

  async function handleDelete(supplier) {
    if (!isAdmin) return;
    if (!window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
    try {
      if (typeof deleteSupplier === 'function') {
        await deleteSupplier(supplier.id);
      } else {
        console.log('Mock delete supplier', supplier);
        alert('Supplier deleted (mock)');
      }
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed — check console');
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
              <div className="sp-stat-title">Supplier List</div>
              <div className="sp-stat-value">{totalSuppliers}</div>
            </div>
          </div>

          {isAdmin ? (
            <button className="btn sp-btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Supplier
            </button>
          ) : (
            <button className="btn sp-btn-muted" onClick={() => alert('Staff cannot add suppliers')}>
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
          {visibleList.length === 0 ? (
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
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleList.map(s => (
                  <tr key={s.id || s.pk}>
                    <td className="sp-prodcol"><span className="sp-prod-name">{s.name}</span></td>
                    <td>{s.contact_name || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.address || '—'}</td>
                    {isAdmin && (
                      <td className="sp-actions-col">
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(s)}><Edit2 size={16} /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(s)}><Trash2 size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* modal */}
      {modalOpen && (
        <div className="sp-modal-overlay" onClick={closeModal}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3>{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <div>
                <button className="btn btn-muted" onClick={closeModal}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginLeft: 8 }}>
                  {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Supplier')}
                </button>
              </div>
            </div>

            <div className="sp-modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <div className="sp-row">
                  <div className="sp-field">
                    <label className="sp-field-label">Company name</label>
                    <input value={form.name} onChange={(e)=>setForm(f=>({...f, name: e.target.value}))} placeholder="Supplier company name" required />
                  </div>
                  <div className="sp-field">
                    <label className="sp-field-label">Contact person</label>
                    <input value={form.contact_name} onChange={(e)=>setForm(f=>({...f, contact_name: e.target.value}))} placeholder="Contact name" />
                  </div>
                </div>

                <div className="sp-row">
                  <div className="sp-field">
                    <label className="sp-field-label">Phone</label>
                    <input value={form.phone} onChange={(e)=>setForm(f=>({...f, phone: e.target.value}))} placeholder="+1234567890" />
                  </div>
                  <div className="sp-field">
                    <label className="sp-field-label">Email</label>
                    <input value={form.email} onChange={(e)=>setForm(f=>({...f, email: e.target.value}))} placeholder="contact@vendor.com" />
                  </div>
                </div>

                <div className="sp-field">
                  <label className="sp-field-label">Address</label>
                  <input value={form.address} onChange={(e)=>setForm(f=>({...f, address: e.target.value}))} placeholder="Street, City, Country" />
                </div>

                <div className="sp-field">
                  <label className="sp-field-label">Notes (optional)</label>
                  <textarea value={form.notes} onChange={(e)=>setForm(f=>({...f, notes: e.target.value}))} rows={3} placeholder="Any notes"></textarea>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
