// src/pages/purchaseorders.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/purchaseorders.css';
import { Plus, ClipboardList, X, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'placed', label: 'Placed', color: '#0ea5a4' },
  { value: 'confirmed', label: 'Confirmed', color: '#6366f1' },
  { value: 'shipped', label: 'Shipped', color: '#f59e0b' },
  { value: 'arrived', label: 'Arrived', color: '#10b981' },
  { value: 'received', label: 'Received', color: '#065f46' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626' },
];

function statusMeta(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || { label: status, color: '#6b7280' };
}

/* ---------------- CreatePOModal ---------------- */
function CreatePOModal({ isOpen, onClose, products = [], suppliers = [], onSave }) {
  const [supplierId, setSupplierId] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultsVisible, setSearchResultsVisible] = useState(false);
  const [lines, setLines] = useState([]); // { productId, name, sku, qty, unitPrice }
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSupplierId('');
      setOrderRef('');
      setExpectedDate('');
      setNotes('');
      setSearchTerm('');
      setSearchResultsVisible(false);
      setLines([]);
      setError('');
    } else {
      // generate orderRef
      setOrderRef('PO-' + Date.now().toString().slice(-6));
    }
  }, [isOpen]);

  const typedSearch = (products || []).filter((p) => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return false;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  }).slice(0, 10);

  function addProductLine(product) {
    setSearchTerm('');
    setSearchResultsVisible(false);
    const existing = lines.find((l) => l.productId === product.id);
    if (existing) {
      setLines(lines.map((l) => l.productId === product.id ? { ...l, qty: l.qty + 1, } : l));
      return;
    }
    setLines([
      ...lines,
      {
        productId: product.id,
        name: product.name || 'Unnamed',
        sku: product.sku || '',
        qty: 1,
        unitPrice: Number(product.sellingPrice ?? product.selling_price ?? 0) || 0,
      },
    ]);
  }

  function updateLine(idx, patch) {
    setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }
  function removeLine(idx) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  function validateAndSave() {
    setError('');
    if (!supplierId) {
      setError('Please choose a supplier.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    for (const l of lines) {
      if (!l.qty || Number(l.qty) <= 0) { setError('Quantity must be at least 1 for all lines.'); return; }
      if (l.unitPrice === '' || Number(l.unitPrice) < 0) { setError('Enter valid unit prices.'); return; }
    }
    // construct payload
    const payload = {
      ref: orderRef,
      supplier: supplierId,
      expected_date: expectedDate || null,
      notes: notes || '',
      lines: lines.map((l) => ({ product_id: l.productId, qty: Number(l.qty), unit_price: Number(l.unitPrice) })),
      status: 'placed',
      created_at: new Date().toISOString(),
    };
    if (typeof onSave === 'function') onSave(payload);
    onClose();
  }

  if (!isOpen) return null;
  return (
    <div className="po-modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="po-modal-header">
          <h3>Create Purchase Order</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="po-icon-btn" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
          </div>
        </div>

        <div className="po-modal-body">
          <div className="po-row">
            <div className="po-field">
              <label className="po-field-label">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="po-small-input">
                <option value="">-- choose supplier --</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company || s.name}</option>)}
              </select>
            </div>
            <div className="po-field">
              <label className="po-field-label">PO Reference</label>
              <input className="po-small-input" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
            </div>
            <div className="po-field">
              <label className="po-field-label">Expected Date</label>
              <input className="po-small-input" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label className="po-field-label">Notes (optional)</label>
            <textarea className="po-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* product search / add */}
          <div style={{ marginTop: 12 }}>
            <label className="po-field-label">Add product (search by name or SKU)</label>
            <div style={{ position: 'relative' }}>
              <input
                className="po-small-input"
                placeholder="Type product name or SKU..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSearchResultsVisible(true); }}
                onFocus={() => setSearchResultsVisible(true)}
              />
              {searchResultsVisible && searchTerm && typedSearch.length > 0 && (
                <ul className="po-search-results" role="listbox">
                  {typedSearch.map((p) => (
                    <li key={p.id} onClick={() => addProductLine(p)} className="po-search-item" role="option">
                      <div style={{ fontWeight: 700, color: 'var(--po-text-primary)' }}>{p.name}</div>
                      <div className="small" style={{ color: 'var(--po-text-muted)' }}>{p.sku ? `SKU: ${p.sku}` : ''} — Price: ₨{(p.sellingPrice ?? p.selling_price ?? 0).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {searchResultsVisible && searchTerm && typedSearch.length === 0 && (
                <ul className="po-search-results">
                  <li className="po-search-item muted">No matches found.</li>
                </ul>
              )}
            </div>
          </div>

          {/* lines table */}
          <div style={{ marginTop: 16 }} className="po-table-wrap">
            {lines.length === 0 ? (
              <div className="po-empty">No products added yet. Use the search above to add lines.</div>
            ) : (
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ width: 120 }}>Unit Price</th>
                    <th style={{ width: 120 }}>Qty</th>
                    <th style={{ width: 120 }}>Line Total</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.productId}>
                      <td>{l.name}</td>
                      <td>{l.sku}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ color: 'var(--po-text-muted)' }}>₨</span>
                          <input
                            className="po-small-input"
                            style={{ width: '100px', padding: '8px' }}
                            type="number"
                            step="0.01"
                            value={l.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          className="po-small-input"
                          style={{ width: '80px', padding: '8px' }}
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => updateLine(idx, { qty: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value || 1)) })}
                        />
                      </td>
                      <td>₨{(Number(l.unitPrice || 0) * Number(l.qty || 0)).toFixed(2)}</td>
                      <td>
                        <button className="icon-btn danger" onClick={() => removeLine(idx)} title="Remove line"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {error && <div className="po-error">{error}</div>}
        </div>

        <div className="po-modal-footer">
          <button className="po-btn po-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="po-btn po-btn-primary" onClick={validateAndSave}>Create PO</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PO Detail Modal ---------------- */
function PoDetailModal({ isOpen, onClose, po, onUpdateStatus, productsById = {}, userRole = 'staff' }) {
  const [localStatus, setLocalStatus] = useState(po?.status || '');

  useEffect(() => setLocalStatus(po?.status || ''), [po]);

  if (!isOpen || !po) return null;
  const meta = statusMeta(localStatus);

  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div className="po-modal" onClick={(e) => e.stopPropagation()}>
        <div className="po-modal-header">
          <h3>PO Details — {po.ref}</h3>
          <div>
            <button className="po-icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="po-modal-body">
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <div>
              <div className="small" style={{ color:'var(--po-text-muted)' }}>Supplier</div>
              <div style={{ fontWeight:700, color:'var(--po-text-primary)' }}>{po.supplier_name || po.supplier || '—'}</div>
            </div>
            <div>
              <div className="small" style={{ color:'var(--po-text-muted)' }}>Created</div>
              <div>{new Date(po.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="small" style={{ color:'var(--po-text-muted)' }}>Expected</div>
              <div>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="small" style={{ color:'var(--po-text-muted)' }}>Status</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <span style={{ background: meta.color, color:'#fff', padding:'6px 10px', borderRadius:8, fontWeight:700 }}>{meta.label}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop:16 }}>
            <h4 style={{ margin:'8px 0' }}>Lines</h4>
            <div className="po-table-wrap">
              <table className="po-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr>
                </thead>
                <tbody>
                  {(po.lines || []).map((ln, i) => {
                    const prod = productsById[ln.product_id] || {};
                    return (
                      <tr key={i}>
                        <td>{ln.product_name || prod.name || 'N/A'}</td>
                        <td>{ln.qty}</td>
                        <td>₨{Number(ln.unit_price || ln.unitPrice || 0).toFixed(2)}</td>
                        <td>₨{(Number(ln.qty || 0) * Number(ln.unit_price || ln.unitPrice || 0)).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div className="small" style={{ color:'var(--po-text-muted)' }}>Notes</div>
              <div style={{ color:'var(--po-text-secondary)' }}>{po.notes || '—'}</div>
            </div>

            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ minWidth: 180 }}>
                <div className="small" style={{ color:'var(--po-text-muted)' }}>Update status</div>
                <select value={localStatus} onChange={(e) => setLocalStatus(e.target.value)} className="po-small-input" disabled={userRole !== 'admin'}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <button className="po-btn po-btn-primary" onClick={() => onUpdateStatus(po.id, localStatus)} disabled={userRole !== 'admin'}>
                Save status
              </button>
            </div>
          </div>
        </div>

        <div className="po-modal-footer">
          <button className="po-btn po-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main PurchaseOrders Page ---------------- */
export default function PurchaseOrders() {
  const dataCtx = useData() || {};
  const { purchaseOrders = [], products = [], suppliers = [], addPurchaseOrder, updatePurchaseOrderStatus } = dataCtx;
  const auth = useAuth() || {};
  const userRole = auth?.user?.role || 'staff';

  // local fallback store if context doesn't provide addPurchaseOrder/updatePurchaseOrderStatus
  const [localPOs, setLocalPOs] = useState([]);
  useEffect(() => {
    if (!purchaseOrders || purchaseOrders.length === 0) {
      setLocalPOs([]);
    } else {
      setLocalPOs([]);
    }
  }, [purchaseOrders]);

  const poList = (purchaseOrders && purchaseOrders.length > 0) ? purchaseOrders : localPOs;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailPo, setDetailPo] = useState(null);

  function handleSavePo(payload) {
    // if context function exists, call it; else manage local
    if (typeof addPurchaseOrder === 'function') {
      addPurchaseOrder(payload);
      alert('PO created');
    } else {
      const id = 'po-' + Date.now();
      setLocalPOs((p) => [{ id, ...payload, id, supplier_name: suppliers.find(s => s.id === payload.supplier)?.company || '', }, ...p]);
      alert('PO (local) created');
    }
  }

  function handleUpdateStatus(poId, status) {
    if (typeof updatePurchaseOrderStatus === 'function') {
      updatePurchaseOrderStatus(poId, status);
      alert('Status updated');
    } else {
      setLocalPOs((prev) => prev.map((p) => p.id === poId ? { ...p, status } : p));
      alert('Status updated (local)');
    }
    // update view
    setDetailPo((dp) => dp && (dp.id === poId ? { ...dp, status } : dp));
  }

  const productsById = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => map[p.id] = p);
    return map;
  }, [products]);

  return (
    <div className="po-page">
      <div className="po-header">
        <div>
          <h2>Purchase Orders</h2>
          <p className="po-sub">Manage supplier purchase orders and track incoming stock</p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="po-btn po-btn-primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> Create PO</button>
        </div>
      </div>

      <div className="card po-list-card">
        <div className="po-list-header">
          <ClipboardList size={18} />
          <span className="po-list-title">Purchase Orders ({poList.length})</span>
        </div>

        <div className="po-card-content">
          {poList.length === 0 ? (
            <div className="po-empty">
              <ClipboardList size={48} className="po-empty-icon" />
              <p>No purchase orders found</p>
              <button className="po-btn po-btn-primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> Create First Purchase Order</button>
            </div>
          ) : (
            <div className="po-list-table-wrapper">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Supplier</th>
                    <th>Created</th>
                    <th>Expected</th>
                    <th>Lines</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poList.map((po) => {
                    const meta = statusMeta(po.status);
                    return (
                      <tr key={po.id}>
                        <td>{po.ref}</td>
                        <td>{po.supplier_name || suppliers.find(s => s.id === po.supplier)?.company || '—'}</td>
                        <td>{new Date(po.created_at).toLocaleDateString()}</td>
                        <td>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
                        <td>{(po.lines || []).length}</td>
                        <td><span style={{ background: meta.color, color:'#fff', padding: '6px 10px', borderRadius: 8, fontWeight:700 }}>{meta.label}</span></td>
                        <td className="po-actions-col">
                          <button className="icon-btn" title="View details" onClick={() => setDetailPo(po)}> <ClipboardList size={16} /> </button>
                          {userRole === 'admin' && (
                            <button className="icon-btn" title="Quick receive" onClick={() => handleUpdateStatus(po.id, 'received')}> <Plus size={16} /> </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CreatePOModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        products={products || []}
        suppliers={suppliers || []}
        onSave={handleSavePo}
      />

      <PoDetailModal
        isOpen={!!detailPo}
        onClose={() => setDetailPo(null)}
        po={detailPo}
        onUpdateStatus={handleUpdateStatus}
        productsById={productsById}
        userRole={userRole}
      />
    </div>
  );
}
