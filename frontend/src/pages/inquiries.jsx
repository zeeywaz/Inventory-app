import React, { useEffect, useMemo, useState } from 'react';
import '../styles/inquiries.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Archive,
  Eye,
} from 'lucide-react';

/**
 * UPDATED Inquiry shape expected:
 * {
 * id,
 * product_name,
 * sku,
 * customer_name,
 * phone,
 * notes,
 * status: 'new' | 'in_progress' | 'completed',
 * created_at,
 * assigned_to,
 * advance_payment: number (NEW)
 * }
 */

// NEW currency formatter
const formatCurrency = (amount) => `₨${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


/* --- Small stat card --- */
function Stat({ title, value, colorClass }) {
  // Using the new ::before stripe styling from the CSS
  return (
    <div className={`inq-stat ${colorClass || ''}`}>
      <div className="inq-stat-title">{title}</div>
      <div className="inq-stat-value">{value}</div>
    </div>
  );
}

/* --- Modal: Create / Edit Inquiry (UPDATED) --- */
function InquiryModal({ open, onClose, inquiry = null, onSave, isAdmin }) {
  const [form, setForm] = useState({
    product_name: '',
    sku: '',
    customer_name: '',
    phone: '',
    notes: '',
    status: 'new',
    advance_payment: '', // NEW field
  });

  useEffect(() => {
    if (inquiry) {
      setForm({
        product_name: inquiry.product_name || '',
        sku: inquiry.sku || '',
        customer_name: inquiry.customer_name || '',
        phone: inquiry.phone || '',
        notes: inquiry.notes || '',
        status: inquiry.status || 'new',
        advance_payment: inquiry.advance_payment || '', // NEW field
      });
    } else {
      setForm({
        product_name: '',
        sku: '',
        customer_name: '',
        phone: '',
        notes: '',
        status: 'new',
        advance_payment: '', // NEW field
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
    // pass back the payload
    onSave({
      ...form,
      status: form.status || 'new',
      advance_payment: Number(form.advance_payment) || 0, // NEW: ensure number
    });
  }

  return (
    <div className="inq-modal-overlay" onClick={onClose}>
      <div className="inq-modal" onClick={(e) => e.stopPropagation()}>
        <header className="inq-modal-header">
          <h3>{inquiry ? 'Edit Inquiry' : 'New Inquiry'}</h3>
          <button className="inq-close" onClick={onClose} aria-label="Close">✕</button>
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

          {/* UPDATED Row for Status and Advance */}
          <div className="inq-row-fields">
            {/* Admin can change status when editing */}
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

            {/* NEW Advance Payment Field */}
            <label className="inq-field">
              <div className="inq-field-label">Advance Payment (₨)</div>
              <input 
                type="number"
                value={form.advance_payment} 
                onChange={updateField('advance_payment')} 
                placeholder="e.g. 5000" 
              />
            </label>
          </div>
        </div>

        <footer className="inq-modal-footer">
          <button className="inq-btn inq-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="inq-btn inq-btn-primary" onClick={save}>{inquiry ? 'Save changes' : 'Create inquiry'}</button>
        </footer>
      </div>
    </div>
  );
}

/* --- Modal: View Inquiry Details (UPDATED) --- */
function InquiryDetailModal({ open, onClose, inquiry }) {
  if (!open || !inquiry) return null;

  return (
    <div className="inq-modal-overlay" onClick={onClose}>
      <div className="inq-modal" onClick={(e) => e.stopPropagation()}>
        <header className="inq-modal-header">
          <h3>Inquiry Details</h3>
          <button className="inq-close" onClick={onClose}>✕</button>
        </header>

        <div className="inq-modal-body">
          <div className="inq-detail-row">
            <strong>Product:</strong> <span>{inquiry.product_name || '—'}</span>
          </div>
          <div className="inq-detail-row">
            <strong>SKU:</strong> <span>{inquiry.sku || '—'}</span>
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
          {/* NEW Advance Payment Row */}
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
          <button className="inq-btn inq-btn-primary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

/* --- Main Page --- */
export default function InquiriesPage() {
  const { inquiries = [], createInquiry, updateInquiry, deleteInquiry } = useData() || {};
  const { user } = useAuth() || {};
  const role = user?.role || 'staff';
  const isAdmin = role === 'admin';

  const [filterStatus, setFilterStatus] = useState('all'); // 'all'|'new'|'in_progress'|'completed'
  const [search, setSearch] = useState('');
  const [list, setList] = useState(inquiries || []);

  // modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editInquiry, setEditInquiry] = useState(null);
  const [viewInquiry, setViewInquiry] = useState(null);

  useEffect(() => setList(inquiries || []), [inquiries]);

  // derived stats
  const stats = useMemo(() => {
    const total = (list || []).length;
    const newCount = (list || []).filter(i => i.status === 'new').length;
    const inProg = (list || []).filter(i => i.status === 'in_progress').length;
    const completed = (list || []).filter(i => i.status === 'completed').length;
    return { total, newCount, inProg, completed };
  }, [list]);

  // filtered + searched results
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list || []).filter(i => {
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

  // create / update / delete handlers (call context if available)
  async function handleCreate(payload) {
    const done = {
      id: Date.now().toString(36),
      ...payload,
      created_at: new Date().toISOString(),
    };
    if (typeof createInquiry === 'function') {
      try {
        await createInquiry(payload);
      } catch (err) {
        console.error(err);
        alert('Create failed — check console');
      }
    } else {
      setList(prev => [done, ...prev]);
      alert('Inquiry created (mock).');
    }
    setShowCreate(false);
  }

  async function handleUpdate(id, payload) {
    if (typeof updateInquiry === 'function') {
      try {
        await updateInquiry(id, payload);
      } catch (err) {
        console.error(err);
        alert('Update failed — check console');
      }
    } else {
      setList(prev => prev.map(i => (i.id === id ? { ...i, ...payload } : i)));
      alert('Inquiry updated (mock).');
    }
    setEditInquiry(null);
  }

  async function handleDelete(inq) {
    if (!isAdmin) return alert('Only admins can delete inquiries.');
    if (!window.confirm(`Delete inquiry for "${inq.product_name}"?`)) return;
    if (typeof deleteInquiry === 'function') {
      try {
        await deleteInquiry(inq.id);
      } catch (err) {
        console.error(err);
        alert('Delete failed — check console');
      }
    } else {
      setList(prev => prev.filter(i => i.id !== inq.id));
      alert('Inquiry deleted (mock).');
    }
  }

  // quick status toggle (staff/admin can update status)
  function changeStatus(inq, nextStatus) {
    const payload = { ...inq, status: nextStatus };
    handleUpdate(inq.id, payload);
  }

  return (
    <div className="inq-page">
      <div className="inq-header">
        <div>
          <h2>Customer Inquiries</h2>
          <p className="inq-sub">Track customer requests for unavailable products</p>
        </div>

        <div className="inq-actions">
          <button className="inq-btn inq-btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Inquiry</button>
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
          <input 
            placeholder="Search product, sku, customer or notes..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            aria-label="Search inquiries"
          />
        </div>
      </div>

      <div className="inq-list card">
        <div className="inq-list-header">
          <div className="inq-list-title"><MessageSquare size={16} /> Inquiries ({visible.length})</div>
        </div>

        <div className="inq-list-body">
          {visible.length === 0 ? (
            <div className="inq-empty">
              <MessageSquare size={48} />
              <p>No inquiries found</p>
              <button className="inq-btn inq-btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Your First Inquiry</button>
            </div>
          ) : (
            <div className="inq-rows">
              {visible.map((i) => (
                <div key={i.id} className="inq-row">
                  <div className="inq-left">
                    <div className="inq-title">{i.product_name} {i.sku ? `(${i.sku})` : ''}</div>
                    <div className="inq-meta">
                      <span>{i.customer_name || 'Walk-in'}</span>
                      <span>{new Date(i.created_at).toLocaleString()}</span>
                      {/* NEW Advance Display */}
                      {i.advance_payment > 0 && (
                        <span className="inq-advance-badge">{formatCurrency(i.advance_payment)} Advance</span>
                      )}
                    </div>
                  </div>

                  <div className="inq-right">
                    <div className="inq-status">
                      <span className={`inq-badge ${i.status}`}>{i.status.replace('_', ' ')}</span>
                    </div>

                    <div className="inq-actions-row">
                      <button className="icon-btn" title="View" onClick={() => setViewInquiry(i)}><Eye size={16} /></button>
                      <button className="icon-btn" title="Edit" onClick={() => setEditInquiry(i)}><Edit2 size={16} /></button>

                      {/* status quick toggles */}
                      {i.status !== 'in_progress' && (
                        <button className="icon-btn" title="Mark In Progress" onClick={() => changeStatus(i, 'in_progress')}><Clock size={16} /></button>
                      )}
                      {i.status !== 'completed' && (
                        <button className="icon-btn" title="Mark Completed" onClick={() => changeStatus(i, 'completed')}><CheckCircle size={16} /></button>
                      )}

                      {isAdmin ? (
                        <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(i)}><Trash2 size={16} /></button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* modals */}
      <InquiryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        isAdmin={isAdmin}
      />

      <InquiryModal
        open={!!editInquiry}
        inquiry={editInquiry}
        onClose={() => setEditInquiry(null)}
        onSave={(payload) => handleUpdate(editInquiry.id, payload)}
        isAdmin={isAdmin}
      />

      <InquiryDetailModal open={!!viewInquiry} inquiry={viewInquiry} onClose={() => setViewInquiry(null)} />
    </div>
  );
}
