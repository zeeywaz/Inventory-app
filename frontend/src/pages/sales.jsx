// src/pages/sales.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/sales.css';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShoppingCart, X, Trash2 } from 'lucide-react';

/* -------------------------
   Small UI helpers & icons
   ------------------------- */
function StatCard({ title, value, subValue, color }) {
  return (
    <div className="card stat-card sales-stat-card" style={{ ['--card-color']: color }}>
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-subvalue">{subValue}</span>
      </div>
    </div>
  );
}

const fmtCurrency = (v) => `₨ ${Number(v || 0).toFixed(2)}`;

/* -------------------------
   Sale detail modal
   ------------------------- */
function SaleDetailModal({ isOpen, onClose, sale }) {
  if (!isOpen || !sale) return null;
  const get = (k) => sale[k] ?? sale[k === 'totalAmount' ? 'total_amount' : k];
  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content sale-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>Sale Details #{String(get('id') ?? '').slice(-6)}</h3>
          <button type="button" className="bill-modal-close" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </div>

        <div className="bill-modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div><strong>Date:</strong> {sale.date ? new Date(sale.date).toLocaleString() : '—'}</div>
              <div><strong>Customer:</strong> {sale.customer_name || sale.customerName || 'Walk-in'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtCurrency(get('total_amount') ?? get('totalAmount'))}</div>
              <div style={{ color: '#6b7280' }}>{sale.payment_method || sale.paymentMethod || ''}</div>
            </div>
          </div>

          <h4 style={{ marginTop: 12 }}>Items</h4>
          <div className="bill-table-wrapper">
            <table className="bill-table detail-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 140 }}>Unit Price</th>
                  <th style={{ width: 140, textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.lines || []).map((ln, i) => {
                  const unit = ln.unit_price ?? ln.unitPrice ?? ln.unitPrice;
                  const qty = ln.quantity ?? ln.qty ?? ln.quantity;
                  const name = ln.product_name ?? ln.productName ?? ln.product_name;
                  return (
                    <tr key={ln.id ?? `ln-${i}`}>
                      <td>{name || 'N/A'}</td>
                      <td>{qty ?? 0}</td>
                      <td>{fmtCurrency(unit)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCurrency((Number(unit || 0) * Number(qty || 0)).toFixed(2))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#6b7280' }}>Subtotal</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtCurrency(get('subtotal') ?? get('total_amount') ?? 0)}</div>
            </div>
          </div>
        </div>

        <div className="bill-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   New / Edit Bill modal (nested lines)
   - if `existing` prop is passed it becomes edit mode
   ------------------------- */
function NewBillModal({ isOpen, onClose, products = [], customers = [], onSave, existing = null, saving = false }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lineUnitPrice, setLineUnitPrice] = useState('');
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // initialize when modal opens or existing changes
  useEffect(() => {
    if (!isOpen) return;
    if (existing) {
      // populate fields from existing sale (be defensive with keys)
      setDate(existing.date ? existing.date.slice(0,10) : new Date().toISOString().slice(0,10));
      setCustomerId(existing.customer ?? existing.customerId ?? '');
      setCustomerName(existing.customer_name ?? existing.customerName ?? '');
      setVehicleNumber(existing.vehicle_number ?? existing.vehicleNumber ?? '');
      setPaymentMethod(existing.payment_method ?? existing.paymentMethod ?? 'cash');
      setNotes(existing.notes ?? '');
      // map backend sale lines to our UI line shape
      const initLines = (existing.lines || []).map((ln) => ({
        id: ln.id ?? `ln-${Math.random().toString(36).slice(2,8)}`,
        productId: ln.product ?? ln.product_id ?? ln.productId,
        productName: ln.product_name ?? ln.productName ?? (ln.product_obj?.name) ?? '',
        quantity: Number(ln.quantity ?? ln.qty ?? ln.quantity ?? ln.qty_ordered ?? 0),
        unitPrice: Number(ln.unit_price ?? ln.unitPrice ?? ln.unit_cost ?? ln.unit_cost ?? 0),
        // keep originalLineId for PATCH/line id when saving to backend
        originalLineId: ln.id ?? null,
      }));
      setLines(initLines);
    } else {
      setDate(new Date().toISOString().slice(0,10));
      setCustomerId(customers[0]?.id ?? '');
      setCustomerName('');
      setVehicleNumber('');
      setPaymentMethod('cash');
      setNotes('');
      setSelectedProductId('');
      setLineQty(1);
      setLineUnitPrice('');
      setLines([]);
    }
    setError('');
  }, [isOpen, existing, customers]);

  const getProduct = useCallback((id) => products.find(p => String(p.id) === String(id)), [products]);

  useEffect(() => {
    if (!selectedProductId) { setLineUnitPrice(''); return; }
    const p = getProduct(selectedProductId);
    const price = p?.selling_price ?? p?.sellingPrice ?? p?.price ?? p?.unitPrice ?? 0;
    setLineUnitPrice(price != null ? String(price) : '');
  }, [selectedProductId, getProduct]);

  function addLine() {
    setError('');
    const prod = getProduct(selectedProductId);
    if (!prod) { setError('Select a product to add'); return; }
    const qty = Number(lineQty) || 0;
    const unit = Number(lineUnitPrice) || 0;
    if (qty <= 0) { setError('Quantity must be > 0'); return; }
    if (unit < 0) { setError('Unit price must be >= 0'); return; }
    const newLine = {
      id: `ln-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      productId: prod.id,
      productName: prod.name || prod.title || '',
      quantity: qty,
      unitPrice: unit,
      originalLineId: null,
    };
    setLines(prev => [...prev, newLine]);
    setSelectedProductId('');
    setLineQty(1);
    setLineUnitPrice('');
  }

  function updateLine(id, patch) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  function removeLine(id) {
    setLines(prev => prev.filter(l => l.id !== id));
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.unitPrice || 0) * Number(l.quantity || 0)), 0), [lines]);

  async function handleSave() {
    setError('');
    if (!lines.length) { setError('Add at least one product line'); return; }

    // Build payload that backend SaleSerializer expects:
    // fields: date, customer, subtotal, total_amount, payment_method, notes, lines = [{ product: id, quantity, unit_price, product_name }]
    const payload = {
      date: new Date(date).toISOString(),
      customer: customerId || null,
      customer_name: customerName || undefined,
      vehicle_number: vehicleNumber || undefined,
      payment_method: paymentMethod,
      notes: notes || '',
      subtotal: Number(subtotal),
      total_amount: Number(subtotal),
      lines: lines.map((l) => ({
        // if this line has an originalLineId (existing), include it so backend may update it
        id: l.originalLineId || undefined,
        product: Number(l.productId),
        product_name: l.productName || undefined,
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice),
      })),
    };

    try {
      if (existing && existing.id) {
        // PATCH update sale
        const resp = await api.patch(`/sales/${existing.id}/`, payload);
        if (typeof onSave === 'function') onSave(resp.data, true); // second arg indicates updated
      } else {
        // POST create sale
        const resp = await api.post('/sales/', payload);
        if (typeof onSave === 'function') onSave(resp.data, false); // false = created
      }
      onClose();
    } catch (err) {
      console.error('Save sale failed', err);
      setError(err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Failed to save'));
    }
  }

  if (!isOpen) return null;
  return (
    <div className="bill-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bill-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>{existing ? `Edit Bill #${String(existing.id ?? '').slice(-6)}` : 'New Bill'}</h3>
          <button type="button" className="bill-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bill-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
            <div>
              <label className="label">Customer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={customerId || ''} onChange={(e) => setCustomerId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Walk-in</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="Or name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label className="label">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Vehicle # (optional)</label>
              <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
              <label className="label" style={{ marginTop: 8 }}>Payment</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Add product line */}
          <div style={{ marginTop: 12 }}>
            <label className="label">Add product</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
              </select>
              <input type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} style={{ width: 84 }} />
              <input type="number" min="0" step="0.01" value={lineUnitPrice} onChange={(e) => setLineUnitPrice(e.target.value)} style={{ width: 120 }} />
              <button type="button" className="btn primary" onClick={addLine}><Plus /> Add</button>
            </div>
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div style={{ marginTop: 12 }} className="bill-table-wrapper">
              <table className="bill-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 120 }}>Unit</th>
                    <th style={{ width: 100 }}>Qty</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Line total</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(ln => (
                    <tr key={ln.id}>
                      <td>{ln.productName}</td>
                      <td>
                        <input type="number" value={ln.unitPrice} onChange={(e) => updateLine(ln.id, { unitPrice: Number(e.target.value) })} />
                      </td>
                      <td>
                        <input type="number" min="0" value={ln.quantity} onChange={(e) => updateLine(ln.id, { quantity: Number(e.target.value) })} />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtCurrency(Number(ln.unitPrice || 0) * Number(ln.quantity || 0))}</td>
                      <td>
                        <button type="button" className="icon-btn" onClick={() => removeLine(ln.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#6b7280' }}>
              <label className="label">Notes</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div style={{ width: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="muted">Subtotal</div>
                <div style={{ fontWeight: 800 }}>{fmtCurrency(subtotal)}</div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <div style={{ fontWeight: 700 }}>Grand total</div>
                <div style={{ fontWeight: 900 }}>{fmtCurrency(subtotal)}</div>
              </div>
            </div>
          </div>

          {error && <div style={{ marginTop: 10, color: '#b91c1c' }}>{error}</div>}
        </div>

        <div className="bill-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || lines.length === 0}>{saving ? 'Saving…' : (existing ? 'Save changes' : 'Create bill')}</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   Main Sales page
   ------------------------- */
export default function Sales() {
  const { user } = useAuth() || {};
  const isAdmin = !!(user && (user.is_superuser || user.is_staff || user.role === 'admin'));
  // states
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // load lists
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadSales(), loadProducts(), loadCustomers()]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function loadSales() {
    try {
      const resp = await api.get('/sales/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? resp.data;
      setSales(raw || []);
    } catch (err) {
      console.error('Failed to load sales', err);
      setSales([]);
    }
  }
  async function loadProducts() {
    try {
      const resp = await api.get('/products/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? resp.data;
      setProducts(raw || []);
    } catch (err) {
      console.error('Failed to load products', err);
      setProducts([]);
    }
  }
  async function loadCustomers() {
    try {
      const resp = await api.get('/customers/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? resp.data;
      setCustomers(raw || []);
    } catch (err) {
      console.error('Failed to load customers', err);
      setCustomers([]);
    }
  }

  // open create modal
  function openCreate() {
    setEditingSale(null);
    setIsModalOpen(true);
  }
  function openEdit(sale) {
    setEditingSale(sale);
    setIsModalOpen(true);
  }
  function closeModal() {
    setEditingSale(null);
    setIsModalOpen(false);
  }

  // detail
  function openDetail(sale) {
    setSelectedSale(sale);
    setIsDetailOpen(true);
  }
  function closeDetail() {
    setSelectedSale(null);
    setIsDetailOpen(false);
  }

  async function handleSaveFromModal(dataOrResp, updated) {
    // onSave from modal passes created/updated sale object (server response) as first arg
    // fallback: if onSave passed nothing, reload list
    try {
      if (dataOrResp) {
        // prefer server response object with id
        const createdOrUpdated = dataOrResp;
        // Refresh list: optimistically update in-place
        setSales(prev => {
          const exists = prev.find(p => String(p.id) === String(createdOrUpdated.id));
          if (exists) {
            return prev.map(p => String(p.id) === String(createdOrUpdated.id) ? createdOrUpdated : p);
          } else {
            return [createdOrUpdated, ...(prev || [])];
          }
        });
      } else {
        await loadSales();
      }
    } catch (err) {
      console.warn('handleSaveFromModal error', err);
      await loadSales();
    }
  }

  async function handleDeleteSale(e, sale) {
    e.stopPropagation();
    if (!isAdmin) { alert('Only admins can delete sales.'); return; }
    if (!window.confirm(`Delete sale #${String(sale.id).slice(-6)}? This cannot be undone.`)) return;
    try {
      await api.delete(`/sales/${sale.id}/`);
      setSales(prev => prev.filter(s => String(s.id) !== String(sale.id)));
      alert('Sale deleted');
    } catch (err) {
      console.error('Delete sale failed', err);
      alert('Delete failed: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  // derived stats
  const today = new Date().toDateString();
  const todaySales = (sales || []).filter(s => new Date(s.date).toDateString() === today);
  const todayCount = todaySales.length;
  const todayRevenue = todaySales.reduce((s, it) => s + (Number(it.total_amount ?? it.totalAmount ?? 0) || 0), 0);

  return (
    <div className="sales-page">
      <NewBillModal
        isOpen={isModalOpen}
        onClose={closeModal}
        products={products}
        customers={customers}
        existing={editingSale}
        onSave={handleSaveFromModal}
        saving={saving}
      />

      <SaleDetailModal isOpen={isDetailOpen} onClose={closeDetail} sale={selectedSale} />

      <div className="page-header">
        <div className="header-title">
          <h1>Sales</h1>
          <p>Record multi-item bills and track transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="new-bill-button" onClick={openCreate}><Plus size={18} /> New Bill</button>
        </div>
      </div>

      <div className="sales-stat-grid">
        <StatCard title="Today's Bills" value={todayCount} subValue="transactions" color="#8b5cf6" />
        {isAdmin && <StatCard title="Today's Revenue" value={fmtCurrency(todayRevenue)} subValue="total revenue" color="#10b981" />}
      </div>

      <div className="card sales-history-card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} />
            <h2 className="card-title">Sales history ({sales.length})</h2>
          </div>
        </div>

        <div className="card-content">
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : (sales || []).length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={48} className="empty-icon" />
              <p>No sales recorded yet</p>
              <button className="record-sale-button" onClick={openCreate}><Plus size={18} /> Record Sale</button>
            </div>
          ) : (
            <div className="sales-history-list">
              {(sales || []).slice().reverse().map(s => {
                const total = Number(s.total_amount ?? s.totalAmount ?? 0);
                return (
                  <div
                    key={s.id}
                    className="sale-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(s)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(s); }}
                  >
                    <div className="sale-details">
                      <div className="sale-id">#{String(s.id ?? '').slice(-6)}</div>
                      <div className="sale-meta">
                        <span>{s.date ? new Date(s.date).toLocaleString() : '—'}</span>
                        <span>{s.customer_name ?? s.customerName ?? 'Walk-in'} · {(s.lines || []).length} items</span>
                      </div>
                    </div>

                    <div className="sale-actions">
                      <div className="sale-amount">{isAdmin ? fmtCurrency(total) : '—'}</div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                          title="Edit sale"
                          aria-label="Edit sale"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={(e) => handleDeleteSale(e, s)}
                            title="Delete sale"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
