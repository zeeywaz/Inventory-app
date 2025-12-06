// src/pages/purchaseorders.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/purchaseorders.css';
import { Plus, ClipboardList, X, Trash2, Edit, DollarSign, Calendar } from 'lucide-react';
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
        productObj: product,
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
    return {
      po_no: orderRef || undefined,
      supplier_id: supplierId ? Number(supplierId) : null,
      expected_date: expectedDate || null,
      notes: notes || '',
      status: 'placed',
      total_amount: Number(totalAmount),
      amount_paid: 0, // Initial creation usually has 0 paid, payments are recorded separately
      payment_status: 'unpaid',
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

  return (
    <div className="po-modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="po-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="po-modal-header">
          <h3>Create Purchase Order</h3>
          <button className="po-icon-btn" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
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

          <div className="po-row">
            <div className="po-field">
              <label className="po-field-label">Total Order Value</label>
              <input className="po-small-input" value={formatCurrency(totalAmount)} disabled readOnly />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label className="po-field-label">Notes (optional)</label>
            <textarea className="po-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="po-table-wrap">
            {lines.length === 0 ? (
              <div className="po-empty">No products added yet.</div>
            ) : (
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 120 }}>Unit Cost</th>
                    <th style={{ width: 120 }}>Qty</th>
                    <th style={{ width: 120 }}>Line Total</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={`${l.productId}-${idx}`}>
                      <td>
                        <div>{l.name}</div>
                        <div className="small" style={{color: '#6b7280'}}>{l.sku}</div>
                      </td>
                      <td>
                        <input
                          className="po-small-input"
                          type="number"
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="po-small-input"
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => updateLine(idx, { qty: e.target.value })}
                        />
                      </td>
                      <td>{formatCurrency(Number(l.unitPrice || 0) * Number(l.qty || 0))}</td>
                      <td>
                        <button className="icon-btn danger" onClick={() => removeLine(idx)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {error && <div className="po-error" role="alert">{error}</div>}
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

/* ---------------- RecordPaymentModal ---------------- */
function RecordPaymentModal({ isOpen, onClose, po, onSave }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMethod('bank_transfer');
      setReference('');
      setNotes('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setError('');
    setLoading(true);

    // Identify supplier ID (could be object or ID in the PO)
    const supplierId = (typeof po.supplier === 'object' && po.supplier?.id) 
      ? po.supplier.id 
      : po.supplier;

    try {
      const payload = {
        supplier: supplierId,
        purchase_order: po.id,
        amount: Number(amount),
        payment_method: method,
        reference: reference,
        notes: notes,
      };

      // Calls backend to create payment
      // This will automatically increment PO.amount_paid on the server side
      await api.post('/supplier-payments/', payload);
      
      onSave(); // Refresh parent
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div className="po-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="po-modal-header">
          <h3>Record Payment</h3>
          <button className="po-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="po-modal-body">
          <div className="po-field">
            <label className="po-field-label">Amount</label>
            <input 
              type="number" 
              className="po-small-input" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="po-field" style={{ marginTop: 12 }}>
            <label className="po-field-label">Payment Method</label>
            <select className="po-small-input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="po-field" style={{ marginTop: 12 }}>
            <label className="po-field-label">Reference / Transaction ID</label>
            <input 
              className="po-small-input" 
              value={reference} 
              onChange={(e) => setReference(e.target.value)} 
              placeholder="e.g. TXN-12345"
            />
          </div>
          <div className="po-field" style={{ marginTop: 12 }}>
            <label className="po-field-label">Notes</label>
            <textarea 
              className="po-field" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={3}
            />
          </div>
          {error && <div className="po-error" style={{marginTop: 10}}>{error}</div>}
        </div>
        <div className="po-modal-footer">
          <button className="po-btn po-btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="po-btn po-btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PoDetailModal ---------------- */
function PoDetailModal({ isOpen, onClose, po, onUpdateStatus, onPaymentRecorded, productsById = {}, userRole = 'staff', updating }) {
  const [localStatus, setLocalStatus] = useState(po?.status || '');
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // map: lineKey -> qty_received
  const [receivedMap, setReceivedMap] = useState({});
  const [confirmReceived, setConfirmReceived] = useState(false);

  useEffect(() => {
    if (po && isOpen) {
      setLocalStatus(po.status || '');
      setError('');
      loadPayments(); // Fetch payment history
      
      const map = {};
      (po.lines || []).forEach((ln, idx) => {
        const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${idx}`;
        map[key] = ln.qty_received ?? ln.qty_ordered ?? ln.qty ?? 0;
      });
      setReceivedMap(map);
      setConfirmReceived(false);
    }
  }, [po, isOpen]);

  async function loadPayments() {
    if (!po?.id) return;
    setLoadingPayments(true);
    try {
      // Backend filter: ?purchase_order_id=X
      const res = await api.get(`/supplier-payments/?purchase_order_id=${po.id}`);
      setPayments(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (e) {
      console.error("Failed to load payments", e);
    } finally {
      setLoadingPayments(false);
    }
  }

  if (!isOpen || !po) return null;

  const meta = statusMeta(localStatus);
  const total = po.total_amount || 0;
  // Use amount_paid from PO (which includes all recorded payments)
  const paid = po.amount_paid || 0; 
  const balance = total - paid;
  const payMeta = paymentStatusMeta(computePaymentStatus(paid, total));

  function setReceivedForLine(ln, value) {
    const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${po.lines.indexOf(ln)}`;
    setReceivedMap((m) => ({ ...m, [key]: Number(value || 0) }));
  }

  function buildLinesPayload() {
    const payload = (po.lines || []).map((ln, idx) => {
      const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${idx}`;
      const qty_received = Number(receivedMap[key] ?? ln.qty_ordered ?? ln.qty ?? 0);
      if (ln.id != null) return { id: ln.id, qty_received };
      const rawProduct = ln.product ?? ln.product_id ?? (ln.productObj && (ln.productObj.id || ln.productObj.pk));
      const productId = (typeof rawProduct === 'object' && rawProduct !== null) ? (rawProduct.id || rawProduct.pk) : rawProduct;
      return { product: productId == null ? null : Number(productId), qty_received };
    });
    return payload;
  }

  async function saveStatus() {
    if (userRole !== 'admin') return alert('Only admins can update status.');
    setError('');

    if (localStatus === 'completed' && !confirmReceived) {
      setError('Please confirm items received by checking the confirmation box.');
      return;
    }

    try {
      if (typeof onUpdateStatus === 'function') {
        const extra = localStatus === 'completed' ? { lines: buildLinesPayload() } : undefined;
        await onUpdateStatus(po.id, localStatus, extra);
      }
      onClose();
    } catch (err) {
      console.error('Save status failed', err);
      setError(err?.response?.data ? JSON.stringify(err.response.data) : err.message || 'Failed to save status');
    }
  }

  function handlePaymentSuccess() {
    loadPayments(); // Refresh list
    onPaymentRecorded(); // Refresh parent PO data to get new amount_paid
  }

  return (
    <>
      <div className="po-modal-overlay" onClick={onClose}>
        <div className="po-modal" onClick={(e) => e.stopPropagation()}>
          <div className="po-modal-header">
            <h3>PO Details — {po.po_no || po.ref || po.id}</h3>
            <button className="po-icon-btn" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="po-modal-body">
            {/* Header Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="small" style={{ color: 'var(--po-text-muted)' }}>Supplier</div>
                <div style={{ fontWeight: 700, color: 'var(--po-text-primary)' }}>
                  {po.supplier_name || (typeof po.supplier === 'object' ? (po.supplier.name || po.supplier.company) : po.supplier) || '—'}
                </div>
              </div>
              <div>
                <div className="small" style={{ color: 'var(--po-text-muted)' }}>Expected</div>
                <div>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small" style={{ color: 'var(--po-text-muted)' }}>Status</div>
                <span className="po-badge" style={{ background: meta.color, color: '#fff' }}>{meta.label}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="po-payment-summary">
              <div>
                <div className="small">Total Value</div>
                <div className="po-payment-value">{formatCurrency(total)}</div>
              </div>
              <div>
                <div className="small">Amount Paid</div>
                <div className="po-payment-value paid">{formatCurrency(paid)}</div>
              </div>
              <div>
                <div className="small">Balance Due</div>
                <div className="po-payment-value due">{formatCurrency(balance)}</div>
              </div>
              <div>
                <div className="small">Payment Status</div>
                <span className="po-badge" style={{ background: payMeta.color, color: '#fff', marginTop: 4 }}>{payMeta.label}</span>
              </div>
            </div>

            {/* Payment History Section */}
            <div style={{ marginTop: 20 }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <h4 style={{ margin: 0 }}>Payments</h4>
                {userRole === 'admin' && balance > 0 && (
                   <button className="po-btn po-btn-primary" style={{padding: '4px 10px', fontSize: 13}} onClick={() => setIsPayModalOpen(true)}>
                     <DollarSign size={14} style={{marginRight: 4}}/> Record Payment
                   </button>
                )}
              </div>
              
              {loadingPayments ? (
                <div className="small muted">Loading history...</div>
              ) : payments.length === 0 ? (
                <div className="small muted">No payments recorded yet.</div>
              ) : (
                <div className="po-table-wrap" style={{maxHeight: 150, overflowY: 'auto'}}>
                  <table className="po-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Method</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(pay => (
                        <tr key={pay.id}>
                          <td>{pay.payment_date ? new Date(pay.payment_date).toLocaleDateString() : '-'}</td>
                          <td>{pay.reference || '-'}</td>
                          <td style={{textTransform: 'capitalize'}}>{pay.payment_method?.replace('_', ' ')}</td>
                          <td style={{fontWeight: 600}}>{formatCurrency(pay.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Product Lines */}
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '8px 0' }}>Lines</h4>
              <div className="po-table-wrap">
                <table className="po-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(po.lines || []).map((ln, i) => {
                      const prod = productsById[ln.product] || productsById[ln.product_id] || {};
                      const unit = ln.unit_cost ?? ln.unitPrice ?? 0;
                      const qtyOrdered = ln.qty_ordered ?? ln.qty ?? 0;
                      const name = ln.description || ln.product_name || prod.name || 'N/A';
                      const key = ln.id != null ? `id:${ln.id}` : `p:${ln.product || ln.product_id}-${i}`;
                      const qtyReceived = receivedMap[key] ?? qtyOrdered;

                      return (
                        <tr key={i}>
                          <td>{name}</td>
                          <td>{qtyOrdered}</td>
                          <td>
                            {localStatus === 'completed' ? (
                              <input
                                type="number"
                                min="0"
                                className="po-small-input"
                                value={qtyReceived}
                                onChange={(e) => setReceivedForLine(ln, Math.max(0, parseInt(e.target.value || 0)))}
                                style={{ width: 80 }}
                              />
                            ) : (
                              qtyReceived
                            )}
                          </td>
                          <td>{formatCurrency(Number(unit) * Number(qtyOrdered))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status Controls */}
            <div className="po-controls-grid" style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 12 }}>
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
                  </div>
                )}
              </div>
            </div>

            {error && <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div>}
          </div>

          <div className="po-modal-footer">
            <button className="po-btn po-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      <RecordPaymentModal 
        isOpen={isPayModalOpen} 
        onClose={() => setIsPayModalOpen(false)} 
        po={po}
        onSave={handlePaymentSuccess}
      />
    </>
  );
}

/* ---------------- Main PurchaseOrders Page ---------------- */
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

  async function loadPurchaseOrders() {
    try {
      const resp = await api.get('/purchase-orders/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setPurchaseOrders(raw);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    }
  }

  async function loadProducts() {
    try {
      const resp = await api.get('/products/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? [];
      setProducts(raw);
    } catch (err) { console.error(err); }
  }

  async function loadSuppliers() {
    try {
      const resp = await api.get('/suppliers/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? [];
      setSuppliers(raw);
    } catch (err) { console.error(err); }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadPurchaseOrders(), loadProducts(), loadSuppliers()]);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // create PO
  async function handleSavePo(payload) {
    setSavingPo(true);
    try {
      // Normalize product IDs
      if (Array.isArray(payload.lines)) {
        payload.lines = payload.lines.map((ln) => {
          if (ln.product && typeof ln.product === 'object' && ln.product.id !== undefined) return { ...ln, product: Number(ln.product.id) };
          return ln;
        });
      }
      const resp = await api.post('/purchase-orders/', payload);
      setPurchaseOrders((prev) => [resp.data, ...prev]);
      alert('PO created');
    } catch (err) {
      console.error('Create PO failed', err);
      throw err;
    } finally {
      setSavingPo(false);
    }
  }

  // DELETE PO
  async function handleDeletePo(poId) {
    if (userRole !== 'admin') return alert('Only admins can delete purchase orders.');
    if (!window.confirm('Delete this purchase order?')) return;
    setUpdating(true);
    try {
      await api.delete(`/purchase-orders/${poId}/`);
      setPurchaseOrders((prev) => prev.filter((p) => String(p.id) !== String(poId)));
      if (detailPo && detailPo.id === poId) setDetailPo(null);
    } catch (err) {
      alert('Delete failed');
    } finally {
      setUpdating(false);
    }
  }

  // UPDATE STATUS
  async function handleUpdateStatus(poId, status, extra) {
    setUpdating(true);
    try {
      const payload = { status, ...(extra || {}) };
      
      // Normalize lines if present
      if (Array.isArray(payload.lines)) {
        payload.lines = payload.lines.map(ln => {
           // Basic normalization to ensure IDs are sent correctly
           const id = ln.id || ln.poline_id;
           return { ...ln, id };
        });
      }

      const resp = await api.patch(`/purchase-orders/${poId}/`, payload);
      const updated = resp.data;
      
      // Update local state
      setPurchaseOrders((prev) => prev.map((p) => (String(p.id) === String(poId) ? updated : p)));
      setDetailPo((dp) => (dp && dp.id === poId ? updated : dp));
      alert('Status updated');
      return updated;
    } catch (err) {
      console.error('Update failed', err);
      throw err;
    } finally {
      setUpdating(false);
    }
  }

  // Called when a payment is recorded via modal to refresh the PO amount_paid
  async function handlePaymentRecorded() {
    if (!detailPo) return;
    try {
      const resp = await api.get(`/purchase-orders/${detailPo.id}/`);
      const updated = resp.data;
      setPurchaseOrders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDetailPo(updated);
    } catch(e) {
      console.error("Failed to refresh PO after payment", e);
    }
  }

  const productsById = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  function supplierDisplayName(po) {
    if (po?.supplier_name) return po.supplier_name;
    const supplierId = (typeof po.supplier === 'object' && po.supplier?.id) ? po.supplier.id : po.supplier;
    const s = suppliers.find((sup) => String(sup.id) === String(supplierId));
    return s ? (s.name || s.company || '—') : '—';
  }

  return (
    <div className="po-page">
      <div className="po-header">
        <div>
          <h2>Purchase Orders</h2>
          <p className="po-sub">Manage supplier purchase orders and track incoming stock</p>
        </div>
        <button className="po-btn po-btn-primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> Create PO</button>
      </div>

      <div className="card po-list-card">
        <div className="po-list-header">
          <ClipboardList size={18} />
          <span className="po-list-title">Purchase Orders ({purchaseOrders.length})</span>
        </div>
        <div className="po-card-content">
          {loading ? (
            <div className="po-empty">Loading…</div>
          ) : purchaseOrders.length === 0 ? (
            <div className="po-empty">No purchase orders found.</div>
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
                  {purchaseOrders.map((po) => {
                    const meta = statusMeta(po.status);
                    const payMeta = paymentStatusMeta(computePaymentStatus(po.amount_paid, po.total_amount));
                    return (
                      <tr key={po.id}>
                        <td>{po.po_no || po.ref || po.id}</td>
                        <td>{supplierDisplayName(po)}</td>
                        <td>{po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}</td>
                        <td>{formatCurrency(po.total_amount)}</td>
                        <td>
                          <span className="po-payment-badge" style={{ background: (payMeta.color || '#666') + '20', color: payMeta.color }}>
                            {payMeta.label}
                          </span>
                        </td>
                        <td><span className="po-badge" style={{ background: meta.color, color: '#fff' }}>{meta.label}</span></td>
                        <td className="po-actions-col" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button className="icon-btn" onClick={() => setDetailPo(po)}><ClipboardList size={16} /></button>
                          {userRole === 'admin' && (
                            <button className="icon-btn danger" onClick={() => handleDeletePo(po.id)}><Trash2 size={16} /></button>
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
        onPaymentRecorded={handlePaymentRecorded}
        productsById={productsById}
        userRole={userRole}
        updating={updating}
      />
    </div>
  );
}