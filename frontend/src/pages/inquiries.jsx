// src/pages/InquiriesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../styles/inquiries.css';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Eye,
} from 'lucide-react';

/**
 * Notes / mapping:
 * Backend inquiry fields (your DB):
 *  - product_description
 *  - contact_name
 *  - contact_phone
 *  - expected_price
 *  - advance_amount
 *  - advance_received
 *  - status
 *  - notes
 *  - created_at
 *
 * UI shape used in this component:
 * {
 *   id,
 *   product_name,
 *   sku,               // optional (not present in DB) - stored in product_description fallback
 *   expected_price,
 *   customer_name,
 *   phone,
 *   notes,
 *   status,
 *   created_at,
 *   assigned_to,
 *   advance_payment
 * }
 *
 * CRUD endpoints expected:
 *  GET  /inquiries/
 *  POST /inquiries/
 *  PATCH /inquiries/:id/
 *  DELETE /inquiries/:id/
 *
 * NOTE: Best long-term: add `sku` column to DB + serializer. This file contains a fallback
 * that encodes SKU into product_description as "(SKU: ...)" so it round-trips.
 */

// currency formatter
const formatCurrency = (amount) =>
  `₨${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ----------------------
   mapping helpers
   ---------------------- */

// Try to extract SKU from product_description text formatted like "... (SKU: ABC123)".
// Also accept direct `s.sku` if backend returns it.
function extractSkuFromDescription(desc = '') {
  if (!desc) return '';
  const m = desc.match(/\(SKU:\s*([^)]+)\)/i);
  return m ? m[1].trim() : '';
}

/* map server -> UI */
function mapServerToUI(s) {
  if (!s) return null;

  const product_desc = s.product_description || '';
  const product_name =
    s.product_name || // in case server provides this
    // If product_description was used to store product_name (and SKU embedded), strip the SKU token for display
    (product_desc.replace(/\s*\(SKU:\s*([^)]+)\)\s*$/i, '') || '');

  const sku = s.sku || extractSkuFromDescription(product_desc) || '';

  const customer_name = s.contact_name || (s.customer && s.customer.name) || '';
  const phone = s.contact_phone || (s.customer && s.customer.phone) || '';

  const advance_payment = Number(s.advance_amount ?? 0);
  const expected_price = s.expected_price !== undefined && s.expected_price !== null ? Number(s.expected_price) : null;

  return {
    id: s.id,
    product_name,
    sku,
    expected_price,
    customer_name,
    phone,
    notes: s.notes || '',
    status: s.status || 'new',
    created_at: s.created_at,
    assigned_to: s.assigned_to || null,
    advance_payment,
    _raw: s,
  };
}

/* convert a UI payload -> server payload for create/update */
function mapUIToServerPayload(ui) {
  const server = {};
  // Compose product_description from product_name and sku fallback.
  // If the DB later adds sku column, change this to send sku separately instead.
  if (ui.product_name !== undefined || ui.sku !== undefined) {
    const namePart = ui.product_name ? String(ui.product_name).trim() : '';
    const skuPart = ui.sku ? String(ui.sku).trim() : '';
    server.product_description = namePart + (skuPart ? ` (SKU: ${skuPart})` : '');
  }
  if (ui.customer_name !== undefined) server.contact_name = ui.customer_name;
  if (ui.phone !== undefined) server.contact_phone = ui.phone;
  if (ui.notes !== undefined) server.notes = ui.notes;
  if (ui.status !== undefined) server.status = ui.status;
  if (ui.advance_payment !== undefined) {
    server.advance_amount = Number(ui.advance_payment || 0);
    server.advance_received = Number(ui.advance_payment || 0) > 0;
  }
  if (ui.expected_price !== undefined && ui.expected_price !== null && ui.expected_price !== '') {
    server.expected_price = Number(ui.expected_price || 0);
  }
  return server;
}

/* --- Small stat card --- */
function Stat({ title, value, colorClass }) {
  return (
    <div className={`inq-stat ${colorClass || ''}`}>
      <div className="inq-stat-title">{title}</div>
      <div className="inq-stat-value">{value}</div>
    </div>
  );
}

/* --- Modal: Create / Edit Inquiry --- */
function InquiryModal({ open, onClose, inquiry = null, onSave, isAdmin }) {
  const [form, setForm] = useState({
    product_name: '',
    sku: '',
    expected_price: '',
    customer_name: '',
    phone: '',
    notes: '',
    status: 'new',
    advance_payment: '',
  });

  useEffect(() => {
    if (inquiry) {
      setForm({
        product_name: inquiry.product_name || '',
        sku: inquiry.sku || '',
        expected_price: inquiry.expected_price !== null && inquiry.expected_price !== undefined ? inquiry.expected_price : '',
        customer_name: inquiry.customer_name || '',
        phone: inquiry.phone || '',
        notes: inquiry.notes || '',
        status: inquiry.status || 'new',
        advance_payment:
          inquiry.advance_payment !== undefined && inquiry.advance_payment !== null ? inquiry.advance_payment : '',
      });
    } else {
      setForm({
        product_name: '',
        sku: '',
        expected_price: '',
        customer_name: '',
        phone: '',
        notes: '',
        status: 'new',
        advance_payment: '',
      });
    }
  }, [inquiry, open]);

  if (!open) return null;

  function updateField(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function save() {
    if (!form.product_name.trim() && !form.sku.trim()) {
      alert('Please enter a product name or SKU.');
      return;
    }
    const payload = {
      product_name: form.product_name,
      sku: form.sku || null,
      expected_price: form.expected_price !== '' ? Number(form.expected_price) : null,
      customer_name: form.customer_name || null,
      phone: form.phone || null,
      notes: form.notes || null,
      status: form.status || 'new',
      advance_payment: Number(form.advance_payment) || 0,
    };
    onSave(payload);
  }

  return (
    <div className="inq-modal-overlay" onClick={onClose}>
      <div className="inq-modal" onClick={(e) => e.stopPropagation()}>
        <header className="inq-modal-header">
          <h3>{inquiry ? 'Edit Inquiry' : 'New Inquiry'}</h3>
          <button className="inq-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="inq-modal-body">
          <div className="inq-row-fields">
            <label className="inq-field">
              <div className="inq-field-label">Product name</div>
              <input value={form.product_name} onChange={updateField('product_name')} placeholder="e.g. Engine Oil" />
            </label>
            <label className="inq-field">
              <div className="inq-field-label">SKU</div>
              <input value={form.sku} onChange={updateField('sku')} placeholder="Optional SKU" />
            </label>
          </div>

          <div className="inq-row-fields">
            <label className="inq-field">
              <div className="inq-field-label">Expected price (₨)</div>
              <input type="number" value={form.expected_price} onChange={updateField('expected_price')} placeholder="e.g. 1500" />
            </label>

            <label className="inq-field">
              <div className="inq-field-label">Advance Payment (₨)</div>
              <input type="number" value={form.advance_payment} onChange={updateField('advance_payment')} placeholder="e.g. 5000" />
            </label>
          </div>

          <div className="inq-row-fields">
            <label className="inq-field">
              <div className="inq-field-label">Customer name</div>
              <input value={form.customer_name} onChange={updateField('customer_name')} placeholder="Customer name (optional)" />
            </label>
            <label className="inq-field">
              <div className="inq-field-label">Phone</div>
              <input value={form.phone} onChange={updateField('phone')} placeholder="+94 77 123 4567" />
            </label>
          </div>

          <label className="inq-field">
            <div className="inq-field-label">Notes</div>
            <textarea value={form.notes} onChange={updateField('notes')} placeholder="Customer request or note..." rows={4} />
          </label>

          <div className="inq-row-fields">
            {(inquiry || isAdmin) && (
              <label className="inq-field">
                <div className="inq-field-label">Status</div>
                <select value={form.status} onChange={updateField('status')} disabled={!isAdmin && !!inquiry}>
                  <option value="new">New</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <footer className="inq-modal-footer">
          <button className="inq-btn inq-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="inq-btn inq-btn-primary" onClick={save}>
            {inquiry ? 'Save changes' : 'Create inquiry'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* --- Modal: View Inquiry Details --- */
function InquiryDetailModal({ open, onClose, inquiry }) {
  if (!open || !inquiry) return null;

  return (
    <div className="inq-modal-overlay" onClick={onClose}>
      <div className="inq-modal" onClick={(e) => e.stopPropagation()}>
        <header className="inq-modal-header">
          <h3>Inquiry Details</h3>
          <button className="inq-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="inq-modal-body">
          <div className="inq-detail-row">
            <strong>Product:</strong> <span>{inquiry.product_name || '—'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>SKU:</strong> <span>{inquiry.sku || '—'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Expected Price:</strong> <span>{inquiry.expected_price !== null && inquiry.expected_price !== undefined ? formatCurrency(inquiry.expected_price) : '—'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Customer:</strong> <span>{inquiry.customer_name || 'Walk-in'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Phone:</strong> <span>{inquiry.phone || '—'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Status:</strong> <span className={`inq-badge ${inquiry.status}`}>{inquiry.status}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Advance Payment:</strong>
            <span className="inq-advance-detail">{formatCurrency(inquiry.advance_payment)}</span>
          </div>
          <div className="inq-detail-row">
            <strong>Notes:</strong>
            <div className="inq-notes">{inquiry.notes || '—'}</div>
          </div>
        </div>

        <footer className="inq-modal-footer">
          <button className="inq-btn inq-btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

/* --- Main Page (backend-connected) --- */
export default function InquiriesPage() {
  const { user } = useAuth() || {};
  const role = user?.role || 'staff';
  const isAdmin = role === 'admin';

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [editInquiry, setEditInquiry] = useState(null); // UI-shaped object
  const [viewInquiry, setViewInquiry] = useState(null);

  // Load inquiries
  const loadInquiries = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/inquiries/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      const mapped = raw.map(mapServerToUI);
      setList(mapped);
    } catch (err) {
      console.error('Failed to fetch inquiries', err);
      alert('Could not load inquiries. Check backend/CORS. ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stats
  const stats = useMemo(() => {
    const total = (list || []).length;
    const newCount = (list || []).filter((i) => i.status === 'new').length;
    const inProg = (list || []).filter((i) => i.status === 'in_progress').length;
    const completed = (list || []).filter((i) => i.status === 'completed').length;
    return { total, newCount, inProg, completed };
  }, [list]);

  // visible list after filter + search
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list || []).filter((i) => {
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (!q) return true;
      return (
        (i.product_name || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.customer_name || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    });
  }, [list, filterStatus, search]);

  /* ---- CRUD operations (backend) ---- */

  async function handleCreate(payloadUI) {
    const serverPayload = mapUIToServerPayload(payloadUI);
    try {
      const resp = await api.post('/inquiries/', serverPayload);
      const createdRaw = resp.data;
      const created = mapServerToUI(createdRaw);
      setList((prev) => [created, ...prev]);
      setShowCreate(false);
      alert('Inquiry created');
    } catch (err) {
      console.error('createInquiry error', err);
      alert('Create failed: ' + (err?.response?.data?.detail || err?.response?.data || err.message || String(err)));
    }
  }

  async function handleUpdate(id, payloadUI) {
    const serverPatch = mapUIToServerPayload(payloadUI);
    try {
      const resp = await api.patch(`/inquiries/${id}/`, serverPatch);
      const updatedRaw = resp.data;
      const updated = mapServerToUI(updatedRaw);
      setList((prev) => prev.map((i) => (String(i.id) === String(id) ? updated : i)));
      setEditInquiry(null);
      alert('Inquiry updated');
    } catch (err) {
      console.error('updateInquiry error', err);
      alert('Update failed: ' + (err?.response?.data?.detail || err?.response?.data || err.message || String(err)));
    }
  }

  async function handleDelete(inq) {
    if (!isAdmin) return alert('Only admins can delete inquiries.');
    if (!window.confirm(`Delete inquiry for "${inq.product_name || inq.sku}"?`)) return;
    try {
      await api.delete(`/inquiries/${inq.id}/`);
      setList((prev) => prev.filter((i) => String(i.id) !== String(inq.id)));
      alert('Deleted');
    } catch (err) {
      console.error('deleteInquiry error', err);
      alert('Delete failed: ' + (err?.response?.data || err.message || String(err)));
    }
  }

  // quick status change (PATCH status only)
  async function changeStatus(inq, nextStatus) {
    try {
      const resp = await api.patch(`/inquiries/${inq.id}/`, { status: nextStatus });
      const updated = mapServerToUI(resp.data);
      setList((prev) => prev.map((i) => (String(i.id) === String(inq.id) ? updated : i)));
    } catch (err) {
      console.error('changeStatus error', err);
      alert('Status update failed: ' + (err?.response?.data?.detail || err?.response?.data || err.message || String(err)));
    }
  }

  return (
    <div className="inq-page">
      <div className="inq-header">
        <div>
          <h2>Customer Inquiries</h2>
          <p className="inq-sub">Track customer requests for unavailable products</p>
        </div>

        <div className="inq-actions">
          <button className="inq-btn inq-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Inquiry
          </button>
        </div>
      </div>

      <div className="inq-stats-row">
        <Stat title="Total Inquiries" value={stats.total} colorClass="s-indigo" />
        <Stat title="New" value={stats.newCount} colorClass="s-blue" />
        <Stat title="In Progress" value={stats.inProg} colorClass="s-amber" />
        <Stat title="Completed" value={stats.completed} colorClass="s-green" />
      </div>

      <div className="inq-controls">
        <div className="inq-filter">
          <label htmlFor="status-filter">Filter by Status:</label>
          <select id="status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Inquiries</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="inq-search">
          <Search size={18} className="inq-search-icon" />
          <input placeholder="Search product, sku, customer or notes..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search inquiries" />
        </div>
      </div>

      <div className="inq-list card">
        <div className="inq-list-header">
          <div className="inq-list-title">
            <MessageSquare size={16} /> Inquiries ({visible.length})
          </div>
        </div>

        <div className="inq-list-body">
          {loading ? (
            <div className="inq-empty">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="inq-empty">
              <MessageSquare size={48} />
              <p>No inquiries found</p>
              <button className="inq-btn inq-btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Add Your First Inquiry
              </button>
            </div>
          ) : (
            <div className="inq-rows">
              {visible.map((i) => (
                <div key={i.id} className="inq-row">
                  <div className="inq-left">
                    <div className="inq-title">
                      {i.product_name} {i.sku ? `(${i.sku})` : ''}
                    </div>
                    <div className="inq-meta">
                      <span>{i.customer_name || 'Walk-in'}</span>
                      <span>{i.created_at ? new Date(i.created_at).toLocaleString() : '—'}</span>
                      {i.expected_price !== null && i.expected_price !== undefined && <span className="inq-expected">Expected: {formatCurrency(i.expected_price)}</span>}
                      {i.advance_payment > 0 && <span className="inq-advance-badge">{formatCurrency(i.advance_payment)} Advance</span>}
                    </div>
                  </div>

                  <div className="inq-right">
                    <div className="inq-status">
                      <span className={`inq-badge ${i.status}`}>{(i.status || '').replace('_', ' ')}</span>
                    </div>

                    <div className="inq-actions-row">
                      <button className="icon-btn" title="View" onClick={() => setViewInquiry(i)}>
                        <Eye size={16} />
                      </button>
                      <button className="icon-btn" title="Edit" onClick={() => setEditInquiry(i)}>
                        <Edit2 size={16} />
                      </button>

                      {i.status !== 'in_progress' && (
                        <button className="icon-btn" title="Mark In Progress" onClick={() => changeStatus(i, 'in_progress')}>
                          <Clock size={16} />
                        </button>
                      )}
                      {i.status !== 'completed' && (
                        <button className="icon-btn" title="Mark Completed" onClick={() => changeStatus(i, 'completed')}>
                          <CheckCircle size={16} />
                        </button>
                      )}

                      {isAdmin ? (
                        <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(i)}>
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <InquiryModal open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} isAdmin={isAdmin} />

      {/* Edit modal */}
      <InquiryModal
        open={!!editInquiry}
        inquiry={editInquiry}
        onClose={() => setEditInquiry(null)}
        onSave={(payload) => handleUpdate(editInquiry.id, payload)}
        isAdmin={isAdmin}
      />

      {/* View modal */}
      <InquiryDetailModal open={!!viewInquiry} inquiry={viewInquiry} onClose={() => setViewInquiry(null)} />
    </div>
  );
}
