// src/pages/purchaseorders.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/purchaseorders.css';
import { Plus, ClipboardList, X, Trash2, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#9ca3af' },
  { value: 'placed', label: 'Placed', color: '#0ea5a4' },
  { value: 'partially_received', label: 'Partially Received', color: '#f59e0b' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid', color: '#ef4444' },
  { value: 'partial', label: 'Partial', color: '#f59e0b' },
  { value: 'paid', label: 'Paid', color: '#10b981' },
];

function statusMeta(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || { label: status || 'Unknown', color: '#6b7280' };
}
function paymentStatusMeta(status) {
  return PAYMENT_STATUS_OPTIONS.find((s) => s.value === status) || { label: status || 'Unknown', color: '#6b7280' };
}

const formatCurrency = (amount) =>
  `₨${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Compute payment status from amounts:
 * - unpaid: amount_paid <= 0
 * - paid: amount_paid >= total_amount (total_amount > 0)
 * - partial: otherwise
 */
function computePaymentStatus(amountPaid, totalAmount) {
  const paid = Number(amountPaid || 0);
  const total = Number(totalAmount || 0);
  if (paid <= 0) return 'unpaid';
  if (total <= 0) return paid > 0 ? 'paid' : 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

/* ---------------- CreatePOModal ---------------- */
function CreatePOModal({ isOpen, onClose, products = [], suppliers = [], onSave, saving }) {
  const [supplierId, setSupplierId] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultsVisible, setSearchResultsVisible] = useState(false);
  const [lines, setLines] = useState([]);
  const [amountPaid, setAmountPaid] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(null);

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
      setAmountPaid('');
      setFieldErrors(null);
    } else {
      setOrderRef((prev) => prev || 'PO-' + Date.now().toString().slice(-6));
    }
  }, [isOpen]);

  const totalAmount = lines.reduce((acc, line) => acc + (Number(line.qty || 0) * Number(line.unitPrice || 0)), 0);

  const typedSearch = (products || [])
    .filter((p) => {
      const q = (searchTerm || '').trim().toLowerCase();
      if (!q) return false;
      return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    })
    .slice(0, 10);

  function addProductLine(product) {
    setSearchTerm('');
    setSearchResultsVisible(false);
    setFieldErrors(null);
    const pid = Number(product.id);
    const existing = lines.find((l) => Number(l.productId) === pid);
    if (existing) {
      setLines(lines.map((l) => (Number(l.productId) === pid ? { ...l, qty: Number(l.qty || 0) + 1 } : l)));
      return;
    }
    setLines([
      ...lines,
      {
        productId: pid,
        productObj: product, // keep object if needed
        name: product.name || 'Unnamed',
        sku: product.sku || '',
        qty: 1,
        unitPrice: Number(product.cost_price ?? product.costPrice ?? 0) || 0,
      },
    ]);
  }

  function updateLine(idx, patch) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  function buildPayload() {
    const paid = Number(amountPaid) || 0;
    const finalPaymentStatus = computePaymentStatus(paid, totalAmount);

    return {
      po_no: orderRef || undefined,
      supplier_id: supplierId ? Number(supplierId) : null,
      expected_date: expectedDate || null,
      notes: notes || '',
      status: 'placed',
      total_amount: Number(totalAmount),
      amount_paid: Number(paid),
      payment_status: finalPaymentStatus,
      lines: lines.map((l) => ({
        product: Number(l.productId),
        qty_ordered: Number(l.qty),
        unit_cost: Number(l.unitPrice),
      })),
    };
  }

  async function validateAndSave() {
    setError('');
    setFieldErrors(null);

    if (!supplierId) {
      setError('Please choose a supplier.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    for (const l of lines) {
      if (!l.qty || Number(l.qty) <= 0) {
        setError('Quantity must be at least 1 for all lines.');
        return;
      }
      if (l.unitPrice === '' || Number(l.unitPrice) < 0) {
        setError('Enter valid unit prices.');
        return;
      }
    }

    const payload = buildPayload();

    try {
      if (typeof onSave === 'function') {
        const maybePromise = onSave(payload);
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }
      } else {
        await api.post('/purchase-orders/', payload);
      }
      onClose();
    } catch (err) {
      console.error('Create PO failed', err);
      const resp = err?.response;
      if (resp && resp.data) {
        setFieldErrors(resp.data);
        const firstKey = Object.keys(resp.data)[0];
        const firstVal = resp.data[firstKey];
        setError(`${firstKey}: ${Array.isArray(firstVal) ? firstVal.join(', ') : String(firstVal)}`);
      } else {
        setError(err?.message || 'Create failed');
      }
    }
  }

  if (!isOpen) return null;
  const computedPaymentStatus = computePaymentStatus(amountPaid, totalAmount);
  const pm = paymentStatusMeta(computedPaymentStatus);

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
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name || s.company}</option>)}
              </select>
              {fieldErrors?.supplier && <div className="po-field-error">{String(fieldErrors.supplier)}</div>}
              {fieldErrors?.supplier_id && <div className="po-field-error">{String(fieldErrors.supplier_id)}</div>}
            </div>
            <div className="po-field">
              <label className="po-field-label">PO Reference</label>
              <input className="po-small-input" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
              {fieldErrors?.po_no && <div className="po-field-error">{String(fieldErrors.po_no)}</div>}
            </div>
            <div className="po-field">
              <label className="po-field-label">Expected Date</label>
              <input className="po-small-input" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              {fieldErrors?.expected_date && <div className="po-field-error">{String(fieldErrors.expected_date)}</div>}
            </div>
          </div>

          <div className="po-row">
            <div className="po-field">
              <label className="po-field-label">Amount Paid (Initial)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="po-small-input"
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center' }} title={pm.label}>
                  <span className="po-badge" style={{ background: pm.color, color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 8 }}>{pm.label}</span>
                </span>
              </div>
            </div>
            <div className="po-field">
              <label className="po-field-label">Payment Status</label>
              <input className="po-small-input" value={pm.label} disabled readOnly />
            </div>
            <div className="po-field">
              <label className="po-field-label">Total Order Value</label>
              <input className="po-small-input" value={formatCurrency(totalAmount)} disabled readOnly />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label className="po-field-label">Notes (optional)</label>
            <textarea className="po-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {fieldErrors?.notes && <div className="po-field-error">{String(fieldErrors.notes)}</div>}
          </div>

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
                      <div className="small" style={{ color: 'var(--po-text-muted)' }}>{p.sku ? `SKU: ${p.sku}` : ''} — Cost: {formatCurrency(p.cost_price ?? p.costPrice)}</div>
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

          <div style={{ marginTop: 16 }} className="po-table-wrap">
            {lines.length === 0 ? (
              <div className="po-empty">No products added yet. Use the search above to add lines.</div>
            ) : (
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ width: 120 }}>Unit Cost</th>
                    <th style={{ width: 120 }}>Qty</th>
                    <th style={{ width: 120 }}>Line Total</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={`${l.productId}-${idx}`}>
                      <td>{l.name}</td>
                      <td>{l.sku}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      <td>{formatCurrency(Number(l.unitPrice || 0) * Number(l.qty || 0))}</td>
                      <td>
                        <button className="icon-btn danger" onClick={() => removeLine(idx)} title="Remove line"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {error && <div className="po-error" role="alert">{error}</div>}
          {fieldErrors && (
            <div style={{ marginTop: 8, color: '#b91c1c' }}>
              <strong>Server errors:</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(fieldErrors, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="po-modal-footer">
          <button className="po-btn po-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="po-btn po-btn-primary" onClick={validateAndSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PoDetailModal ---------------- */
function PoDetailModal({ isOpen, onClose, po, onUpdateStatus, onUpdatePayment, productsById = {}, userRole = 'staff', updating }) {
  const [localStatus, setLocalStatus] = useState(po?.status || '');
  const [amountPaid, setAmountPaid] = useState(po?.amount_paid ?? 0);
  const [error, setError] = useState('');

  // map: lineKey -> qty_received (line.id preferred, fallback to product id + idx)
  const [receivedMap, setReceivedMap] = useState({});
  const [confirmReceived, setConfirmReceived] = useState(false);

  useEffect(() => {
    setLocalStatus(po?.status || '');
    setAmountPaid(po?.amount_paid ?? 0);
    setError('');

    const map = {};
    (po?.lines || []).forEach((ln, idx) => {
      const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${idx}`;
      map[key] = ln.qty_received ?? ln.qty_ordered ?? ln.qty ?? 0;
    });
    setReceivedMap(map);
    setConfirmReceived(false);
  }, [po]);

  if (!isOpen || !po) return null;

  const meta = statusMeta(localStatus);
  const total = po.total_amount || 0;
  const balance = total - (Number(amountPaid) || 0);

  // compute payment status from (possibly edited) amountPaid and po.total_amount
  const computedPaymentStatus = computePaymentStatus(amountPaid, po.total_amount);
  const payMeta = paymentStatusMeta(computedPaymentStatus);

  function setReceivedForLine(ln, value) {
    const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${po.lines.indexOf(ln)}`;
    setReceivedMap((m) => ({ ...m, [key]: Number(value || 0) }));
  }

  // Build payload lines for PATCH when completing
  function buildLinesPayload() {
    const payload = (po.lines || []).map((ln, idx) => {
      const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${idx}`;
      const qty_received = Number(receivedMap[key] ?? ln.qty_ordered ?? ln.qty ?? 0);

      if (ln.id != null) {
        return { id: ln.id, qty_received };
      }

      // fallback: normalize product value
      const rawProduct = ln.product ?? ln.product_id ?? (ln.productObj && (ln.productObj.id || ln.productObj.pk));
      const productId = (typeof rawProduct === 'object' && rawProduct !== null) ? (rawProduct.id || rawProduct.pk) : rawProduct;
      return { product: productId == null ? null : Number(productId), qty_received };
    });

    // eslint-disable-next-line no-console
    console.log('Prepared PO lines payload for patch:', payload);
    return payload;
  }

  async function saveStatus() {
    if (userRole !== 'admin') return alert('Only admins can update status.');
    setError('');

    // If user is setting to completed, require confirmation checkbox
    if (localStatus === 'completed') {
      if (!confirmReceived) {
        setError('Please confirm items received by checking the confirmation box.');
        return;
      }
    }

    try {
      if (typeof onUpdateStatus === 'function') {
        const extra = localStatus === 'completed' ? { lines: buildLinesPayload() } : undefined;
        const maybe = onUpdateStatus(po.id, localStatus, extra);
        if (maybe && typeof maybe.then === 'function') await maybe;
      } else {
        // direct API call: include lines when completing
        const payload = localStatus === 'completed' ? { status: localStatus, lines: buildLinesPayload() } : { status: localStatus };
        // eslint-disable-next-line no-console
        console.log('PATCH /purchase-orders/', po.id, payload);
        await api.patch(`/purchase-orders/${po.id}/`, payload);
      }
      alert('Status updated');
      onClose();
    } catch (err) {
      console.error('Save status failed', err);
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err.message || 'Failed to save status');
    }
  }

  async function savePaymentChanges() {
    if (userRole !== 'admin') return alert('Only admins can update payments.');
    setError('');
    try {
      // compute payment status from entered amount and PO total
      const computed = computePaymentStatus(amountPaid, po.total_amount);

      if (typeof onUpdatePayment === 'function') {
        const maybe = onUpdatePayment(po.id, Number(amountPaid), computed);
        if (maybe && typeof maybe.then === 'function') await maybe;
      } else {
        // send amount_paid and computed payment_status to backend
        await api.patch(`/purchase-orders/${po.id}/`, { amount_paid: Number(amountPaid), payment_status: computed });
      }
      alert('Payment updated');
    } catch (err) {
      console.error('Save payment failed', err);
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err.message || 'Failed to save payment');
    }
  }

  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div className="po-modal" onClick={(e) => e.stopPropagation()}>
        <div className="po-modal-header">
          <h3>PO Details — {po.po_no || po.ref || po.id}</h3>
          <div>
            <button className="po-icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="po-modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="small" style={{ color: 'var(--po-text-muted)' }}>Supplier</div>
              <div style={{ fontWeight: 700, color: 'var(--po-text-primary)' }}>
                {po.supplier_name || (typeof po.supplier === 'object' ? (po.supplier.name || po.supplier.company || po.supplier.id) : po.supplier) || '—'}
              </div>
            </div>
            <div>
              <div className="small" style={{ color: 'var(--po-text-muted)' }}>Created</div>
              <div>{po.created_at ? new Date(po.created_at).toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="small" style={{ color: 'var(--po-text-muted)' }}>Expected</div>
              <div>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small" style={{ color: 'var(--po-text-muted)' }}>Status</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="po-badge" style={{ background: meta.color, color: '#fff' }}>{meta.label}</span>
              </div>
            </div>
          </div>

          <div className="po-payment-summary">
            <div>
              <div className="small">Total Value</div>
              <div className="po-payment-value">{formatCurrency(total)}</div>
            </div>
            <div>
              <div className="small">Amount Paid</div>
              <div className="po-payment-value paid">{formatCurrency(amountPaid)}</div>
            </div>
            <div>
              <div className="small">Balance Due (Credit)</div>
              <div className="po-payment-value due">{formatCurrency(balance)}</div>
            </div>
            <div>
              <div className="small">Payment Status</div>
              <div style={{ marginTop: 4 }}>
                <span className="po-badge" style={{ background: payMeta.color, color: '#fff' }}>{payMeta.label}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '8px 0' }}>Lines</h4>
            <div className="po-table-wrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty Ordered</th>
                    <th style={{ width: 140 }}>Unit Cost</th>
                    <th style={{ width: 140 }}>Qty Received</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(po.lines || []).map((ln, i) => {
                    const prod = productsById[ln.product] || productsById[ln.product_id] || {};
                    const unit = ln.unit_cost ?? ln.unitPrice ?? ln.unit_price ?? 0;
                    const qtyOrdered = ln.qty_ordered ?? ln.qty ?? ln.quantity ?? 0;
                    const name = ln.description || ln.product_name || prod.name || 'N/A';
                    const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${i}`;
                    const qtyReceived = receivedMap[key] ?? qtyOrdered;

                    return (
                      <tr key={i}>
                        <td>{name}</td>
                        <td>{qtyOrdered}</td>
                        <td>{formatCurrency(unit)}</td>
                        <td>
                          {localStatus === 'completed' ? (
                            <input
                              type="number"
                              min="0"
                              className="po-small-input"
                              value={qtyReceived}
                              onChange={(e) => setReceivedForLine(ln, Math.max(0, parseInt(e.target.value || 0)))}
                              style={{ width: 90 }}
                            />
                          ) : (
                            qtyReceived
                          )}
                        </td>
                        <td>{formatCurrency(Number(unit || 0) * Number(qtyOrdered || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="po-controls-grid" style={{ marginTop: 12 }}>
            <div className="po-control-group">
              <label className="po-field-label">Update Order Status</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  value={localStatus}
                  onChange={(e) => setLocalStatus(e.target.value)}
                  className="po-small-input"
                  disabled={userRole !== 'admin'}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="po-btn po-btn-secondary" onClick={saveStatus} disabled={userRole !== 'admin' || updating}>
                  {updating ? 'Saving…' : 'Save Status'}
                </button>
              </div>

              {localStatus === 'completed' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={confirmReceived} onChange={(e) => setConfirmReceived(e.target.checked)} />
                    <span className="small">I confirm the received quantities above match the physical items received</span>
                  </label>
                  <div className="small" style={{ color: '#6b7280', marginTop: 6 }}>
                    Qty received will be sent to the server and product stock will be increased accordingly.
                  </div>
                </div>
              )}
            </div>

            <div className="po-control-group">
              <label className="po-field-label">Update Payment</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="po-small-input"
                  disabled={userRole !== 'admin'}
                />
                <button className="po-btn po-btn-secondary" onClick={savePaymentChanges} disabled={userRole !== 'admin' || updating}>
                  {updating ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>

          {error && <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div>}

          <div style={{ marginTop: 16 }}>
            <div className="small" style={{ color: 'var(--po-text-muted)' }}>Notes</div>
            <div style={{ color: 'var(--po-text-secondary)' }}>{po.notes || '—'}</div>
          </div>
        </div>

        <div className="po-modal-footer">
          <button className="po-btn po-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main PurchaseOrders Page (backend-connected) ---------------- */
export default function PurchaseOrders() {
  const auth = useAuth() || {};
  const userRole = auth?.user?.role || 'staff';

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingPo, setSavingPo] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailPo, setDetailPo] = useState(null);

  // Load all required data
  async function loadPurchaseOrders() {
    try {
      const resp = await api.get('/purchase-orders/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setPurchaseOrders(raw);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
      alert('Could not load purchase orders. ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }
  async function loadProducts() {
    try {
      const resp = await api.get('/products/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setProducts(raw);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }
  async function loadSuppliers() {
    try {
      const resp = await api.get('/suppliers/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setSuppliers(raw);
    } catch (err) {
      console.error('Failed to load suppliers', err);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadPurchaseOrders(), loadProducts(), loadSuppliers()]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // create PO -> POST to backend
  async function handleSavePo(payload) {
    setSavingPo(true);
    try {
      // defensive: ensure lines.product are numeric pks
      if (Array.isArray(payload.lines)) {
        payload.lines = payload.lines.map((ln) => {
          if (ln.product && typeof ln.product === 'object' && ln.product.id !== undefined) {
            return { ...ln, product: Number(ln.product.id) };
          }
          if (ln.product !== null && ln.product !== undefined) {
            const maybe = Number(ln.product);
            return { ...ln, product: Number.isNaN(maybe) ? null : maybe };
          }
          return ln;
        });
      }

      const resp = await api.post('/purchase-orders/', payload);
      const created = resp.data;
      setPurchaseOrders((prev) => [created, ...prev]);
      alert('PO created');
      return created;
    } catch (err) {
      console.error('Create PO failed', err);
      throw err;
    } finally {
      setSavingPo(false);
    }
  }

  // DELETE PO (admin only)
  async function handleDeletePo(poId) {
    if (userRole !== 'admin') return alert('Only admins can delete purchase orders.');
    if (!window.confirm('Delete this purchase order? This action cannot be undone.')) return;

    setUpdating(true);
    try {
      await api.delete(`/purchase-orders/${poId}/`);
      setPurchaseOrders((prev) => prev.filter((p) => String(p.id) !== String(poId)));
      setDetailPo((dp) => (dp && String(dp.id) === String(poId) ? null : dp));
      alert('Purchase order deleted');
    } catch (err) {
      console.error('Delete PO failed', err);
      alert('Delete failed: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setUpdating(false);
    }
  }

  // update status (PATCH)
  // Accepts optional `extra` object (e.g. { lines: [...] }) — used when completing to send qty_received
  async function handleUpdateStatus(poId, status, extra) {
    // ensure only allowed backend statuses are sent
    const allowed = STATUS_OPTIONS.map((s) => s.value);
    if (!allowed.includes(status)) {
      const msg = `Status "${status}" is not allowed. Allowed: ${allowed.join(', ')}`;
      console.warn(msg);
      throw new Error(msg);
    }

    setUpdating(true);
    try {
      const payload = { status, ...(extra || {}) };

      // Defensive: if payload.lines exists, normalize item keys and numeric types
      if (Array.isArray(payload.lines)) {
        payload.lines = payload.lines.map((ln) => {
          const item = { ...ln };

          // prefer 'id' but accept poline_id or line_id
          if (item.poline_id && !item.id) item.id = item.poline_id;
          if (item.line_id && !item.id) item.id = item.line_id;

          // accept 'productId' camelCase
          if (item.productId && !item.product) item.product = item.productId;

          if (item.product && typeof item.product === 'object' && item.product.id !== undefined) {
            item.product = Number(item.product.id);
          }
          if (item.product !== null && item.product !== undefined) {
            const maybe = Number(item.product);
            item.product = Number.isNaN(maybe) ? null : maybe;
          }

          if (item.id !== undefined && item.id !== null) {
            const mid = Number(item.id);
            item.id = Number.isNaN(mid) ? undefined : mid;
          }

          if (item.qty_received !== undefined) {
            item.qty_received = Number(item.qty_received || 0);
          }
          return item;
        });
      }

      // debug: log payload to console (server logs)
      // eslint-disable-next-line no-console
      console.log('PATCH payload for PO', poId, payload);

      const resp = await api.patch(`/purchase-orders/${poId}/`, payload);
      const updated = resp.data;

      // If this was a completion and server returned updated lines with qty_received,
      // update local product quantities by the delta between previous and new qty_received.
      if (status === 'completed') {
        const prevPo = purchaseOrders.find((p) => String(p.id) === String(poId));
        const prevLines = prevPo?.lines || [];
        const updatedLines = updated?.lines || [];

        const deltas = {};
        updatedLines.forEach((ln) => {
          const newReceived = ln.qty_received ?? ln.qty_ordered ?? 0;
          const prevLn = prevLines.find((pl) => (pl.id != null && pl.id === ln.id) || (pl.product === ln.product));
          const prevReceived = prevLn ? (prevLn.qty_received ?? prevLn.qty_ordered ?? 0) : 0;
          const delta = Number(newReceived) - Number(prevReceived || 0);
          if (delta > 0) {
            deltas[ln.product] = (deltas[ln.product] || 0) + delta;
          }
        });

        if (Object.keys(deltas).length > 0) {
          setProducts((prevProds) =>
            prevProds.map((pr) => {
              const add = deltas[pr.id];
              if (!add) return pr;
              return { ...pr, quantity_in_stock: (Number(pr.quantity_in_stock || 0) + add) };
            })
          );
        }
      }

      // update POs + detail view
      setPurchaseOrders((prev) => prev.map((p) => (String(p.id) === String(poId) ? updated : p)));
      setDetailPo((dp) => (dp && dp.id === poId ? updated : dp));
      alert('Status updated');
      return updated;
    } catch (err) {
      console.error('Update PO status failed', err);
      throw err;
    } finally {
      setUpdating(false);
    }
  }

  // update payment (PATCH)
  // We only allow editing amount_paid in UI; compute payment_status automatically and send both so server stays in sync.
  async function handleUpdatePayment(poId, amountPaidValue, _maybePaymentStatusIgnored) {
    setUpdating(true);
    try {
      // compute payment status to keep server in sync
      const po = purchaseOrders.find((p) => String(p.id) === String(poId));
      const total = po?.total_amount ?? 0;
      const computed = computePaymentStatus(amountPaidValue, total);

      const resp = await api.patch(`/purchase-orders/${poId}/`, { amount_paid: Number(amountPaidValue), payment_status: computed });
      const updated = resp.data;
      setPurchaseOrders((prev) => prev.map((p) => (String(p.id) === String(poId) ? updated : p)));
      setDetailPo((dp) => (dp && dp.id === poId ? updated : dp));
      alert('Payment updated');
      return updated;
    } catch (err) {
      console.error('Update PO payment failed', err);
      throw err;
    } finally {
      setUpdating(false);
    }
  }

  const productsById = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  // helper to display supplier friendly name
  function supplierDisplayName(po) {
    if (po?.supplier_name) return po.supplier_name;
    const supplierId = (typeof po.supplier === 'object' && po.supplier?.id) ? po.supplier.id : po.supplier;
    const s = suppliers.find((sup) => String(sup.id) === String(supplierId));
    return s ? (s.name || s.company || '—') : '—';
  }

  const poList = purchaseOrders || [];

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
          {loading ? (
            <div className="po-empty">Loading…</div>
          ) : poList.length === 0 ? (
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
                    <th>Total Value</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poList.map((po) => {
                    const meta = statusMeta(po.status);
                    // prefer server-side payment_status but compute if missing or to reflect amount change
                    const clientComputed = computePaymentStatus(po.amount_paid, po.total_amount);
                    const effectivePaymentStatus = po.payment_status ?? clientComputed;
                    const payMeta = paymentStatusMeta(effectivePaymentStatus);

                    return (
                      <tr key={po.id}>
                        <td>{po.po_no || po.ref || po.id}</td>
                        <td>{supplierDisplayName(po)}</td>
                        <td>{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</td>
                        <td>{formatCurrency(po.total_amount)}</td>
                        <td>
                          <span className="po-payment-badge" style={{ background: (payMeta.color || '#666') + '20', color: payMeta.color }}>
                            {payMeta.label}
                          </span>
                        </td>
                        <td><span className="po-badge" style={{ background: meta.color, color: '#fff' }}>{meta.label}</span></td>
                        <td className="po-actions-col" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button className="icon-btn" title="View details" onClick={() => setDetailPo(po)}> <ClipboardList size={16} /> </button>
                          {userRole === 'admin' && (
                            <>
                              <button className="icon-btn" title="Edit Payments/Status" onClick={() => setDetailPo(po)}> <Edit size={16} /> </button>
                              <button className="icon-btn danger" title="Delete PO" onClick={() => handleDeletePo(po.id)} disabled={updating}>
                                <Trash2 size={16} />
                              </button>
                            </>
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
        saving={savingPo}
      />

      <PoDetailModal
        isOpen={!!detailPo}
        onClose={() => setDetailPo(null)}
        po={detailPo}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePayment={handleUpdatePayment}
        productsById={productsById}
        userRole={userRole}
        updating={updating}
      />
    </div>
  );
}
