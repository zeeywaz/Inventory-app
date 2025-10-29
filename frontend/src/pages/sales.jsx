// src/pages/sales.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/sales.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShoppingCart, X, Trash2, UserCheck } from 'lucide-react';

// --- Reusable Stat Card Component ---
function StatCard({ title, value, subValue, icon, color }) {
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

// --- Sale Detail Modal used by Sales ---
function SaleDetailModal({ isOpen, onClose, sale }) {
  if (!isOpen || !sale) return null;
  const fmt = (amt) => `₨ ${(Number(amt) || 0).toFixed(2)}`;
  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-content sale-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>Sale Details (#{(sale.id || '').toString().slice(-6)})</h3>
          <button type="button" className="bill-modal-close" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </div>
        <div className="bill-modal-body">
          <div className="sale-detail-summary">
            <div><strong>Date:</strong> {new Date(sale.date).toLocaleString()}</div>
            <div><strong>Customer:</strong> {sale.customerName || 'Walk-in'}</div>
            {sale.vehicleNumber && <div><strong>Vehicle #:</strong> {sale.vehicleNumber}</div>}
          </div>

          <h4>Items Sold</h4>
          <div className="bill-table-wrapper">
            <table className="bill-table detail-table">
              <thead>
                <tr>
                  <th className="th-product">Product</th>
                  <th className="th-qty">Qty</th>
                  <th className="th-price">Unit Price</th>
                  <th className="th-total">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.lines || []).map((line, idx) => (
                  <tr key={line.productId ?? `line-${idx}`}>
                    <td data-label="Product">{line.productName || 'N/A'}</td>
                    <td data-label="Qty">{line.quantity || 0}</td>
                    <td data-label="Unit Price">{fmt(line.unitPrice)}</td>
                    <td data-label="Line Total">{fmt(line.unitPrice * (line.quantity || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bill-summary-section detail-summary">
            <div className="summary-line grand-total-line">
              <span className="grand-total-label">Grand Total</span>
              <span className="grand-total-value">{fmt(sale.totalAmount)}</span>
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

// --- NewBillModal (full working popup) ---
function NewBillModal({ isOpen, onClose, products = [], customers = [], onSaveBill }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // product selection for adding line
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lineUnitPrice, setLineUnitPrice] = useState('');
  const [lines, setLines] = useState([]);

  const [error, setError] = useState('');

  // keep body scroll locked when modal open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // set defaults when opened
  useEffect(() => {
    if (!isOpen) return;
    setDate(new Date().toISOString().slice(0, 10));
    setCustomerId(customers[0]?.id || '');
    setCustomerName('');
    setVehicleNumber('');
    setPaymentMethod('cash');
    setNotes('');
    setSelectedProductId('');
    setLineQty(1);
    setLineUnitPrice('');
    setLines([]);
    setError('');
  }, [isOpen, customers]);

  // helper to get product object
  const getProductById = useCallback((id) => {
    return products.find(p => String(p.id) === String(id));
  }, [products]);

  // when selected product changes, auto-fill unit price
  useEffect(() => {
    if (!selectedProductId) { setLineUnitPrice(''); return; }
    const p = getProductById(selectedProductId);
    const price = p?.price ?? p?.unitPrice ?? p?.sellingPrice ?? 0;
    setLineUnitPrice(price != null ? String(price) : '');
  }, [selectedProductId, getProductById]);

  const addLine = () => {
    setError('');
    const prod = getProductById(selectedProductId);
    if (!prod) { setError('Select a valid product to add.'); return; }
    const qty = Number(lineQty) || 0;
    const unit = Number(lineUnitPrice) || 0;
    if (qty <= 0) { setError('Quantity must be > 0'); return; }
    if (unit < 0) { setError('Unit price must be >= 0'); return; }

    const newLine = {
      id: `ln-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      productId: prod.id,
      productName: prod.name || prod.title || 'Unnamed',
      quantity: qty,
      unitPrice: unit
    };
    setLines(prev => [...prev, newLine]);

    // reset selection
    setSelectedProductId('');
    setLineQty(1);
    setLineUnitPrice('');
  };

  const updateLine = (lineId, patch) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, ...patch } : l));
  };

  const removeLine = (lineId) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const grandTotal = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);
  }, [lines]);

  function handleSave() {
    setError('');
    if (!lines.length) { setError('Add at least one product line.'); return; }
    const billData = {
      id: `bill-${Date.now()}`,
      date: new Date(date).toISOString(),
      customerId: customerId || null,
      customerName: customerName || (customers.find(c => String(c.id) === String(customerId))?.name) || 'Walk-in',
      vehicleNumber: vehicleNumber || null,
      paymentMethod,
      notes,
      totalAmount: Math.round(grandTotal * 100) / 100,
      created_at: new Date().toISOString(),
    };
    // onSaveBill expects billData and billLines
    if (typeof onSaveBill === 'function') {
      try {
        onSaveBill(billData, lines);
      } catch (err) {
        console.error('onSaveBill threw', err);
      }
    }
    onClose();
  }

  // close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="bill-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bill-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="bill-modal-header">
          <h3>New Bill</h3>
          <button type="button" className="bill-modal-close" onClick={onClose} aria-label="Close new bill"><X size={18} /></button>
        </div>

        <div className="bill-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, alignItems: 'start' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Customer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
                >
                  <option value="">Walk-in</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
                  ))}
                </select>
                <input
                  placeholder="Or enter name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8', minWidth: 160 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8', background: '#fff', color: '#000', fontWeight: 600 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Add product</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.title} — {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                  style={{ width: 84, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
                  aria-label="Quantity"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lineUnitPrice}
                  onChange={(e) => setLineUnitPrice(e.target.value)}
                  style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
                  aria-label="Unit price"
                />

                <button type="button" className="btn primary" onClick={addLine} aria-label="Add product line">
                  <Plus /> Add
                </button>
              </div>
            </div>
          </div>

          {lines.length > 0 && (
            <div style={{ marginTop: 14 }} className="bill-table-wrapper">
              <table className="bill-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 110 }}>Unit</th>
                    <th style={{ width: 110 }}>Qty</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Line Total</th>
                    <th style={{ width: 64 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((ln) => (
                    <tr key={ln.id}>
                      <td data-label="Product">{ln.productName}</td>
                      <td data-label="Unit">
                        <input
                          type="number"
                          value={ln.unitPrice}
                          onChange={(e) => updateLine(ln.id, { unitPrice: Number(e.target.value) })}
                          style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #f0f3f8' }}
                        />
                      </td>
                      <td data-label="Qty">
                        <input
                          type="number"
                          min="0"
                          value={ln.quantity}
                          onChange={(e) => updateLine(ln.id, { quantity: Number(e.target.value) })}
                          style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid #f0f3f8' }}
                        />
                      </td>
                      <td data-label="Line Total" style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₨ {(Number(ln.unitPrice || 0) * Number(ln.quantity || 0)).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" className="icon-btn" onClick={() => removeLine(ln.id)} aria-label="Remove">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Vehicle # (optional)</label>
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. ABC-1234"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
              />

              <label style={{ display: 'block', marginTop: 10, marginBottom: 6, fontSize: 13, color: '#374151' }}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#6b7280' }}>Subtotal</div>
                <div style={{ fontWeight: 800 }}>₨ {grandTotal.toFixed(2)}</div>
              </div>

              {/* (Optional) taxes/discounts could go here */}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Grand total</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>₨ {grandTotal.toFixed(2)}</div>
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151' }}>Payment method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eef8' }}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {error && <div style={{ marginTop: 12, color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
        </div>

        <div className="bill-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={lines.length === 0}>
            Save Bill
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Sales Component ---
export default function Sales() {
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // Use data & auth for role decisions
  const { sales = [], products = [], customers = [], addSale } = useData() || {};
  const { isAdmin = false, isStaff = false } = useAuth() || {};

  const openBillModal = () => setIsBillModalOpen(true);
  const closeBillModal = () => setIsBillModalOpen(false);

  const openDetailModal = (sale) => { setSelectedSale(sale); setIsDetailModalOpen(true); };
  const closeDetailModal = () => { setSelectedSale(null); setIsDetailModalOpen(false); };

  // calculations
  const today = new Date().toDateString();
  const todaySales = (sales || []).filter((s) => new Date(s.date).toDateString() === today);
  const todayBillsCount = todaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.totalAmount || s.total_amount || 0)), 0);

  const handleSaveBillFromModal = (billData, billLines) => {
    if (typeof addSale === 'function') {
      try {
        const result = addSale(billData, billLines);
        if (result && result.success) { alert('Bill saved successfully!'); }
        else { alert('Saved (best-effort).'); }
      } catch (err) {
        console.error(err); alert('Error saving bill.');
      }
    } else {
      // fallback: add to local array (not persisted)
      console.log('Prepared bill:', billData, billLines);
      alert('Bill prepared (UI-only).');
    }
    closeBillModal();
  };

  const handleDeleteSale = (e, saleId) => {
    e.stopPropagation();
    if (!isAdmin) { alert('Only admins can delete sales.'); return; }
    if (window.confirm(`Delete sale #${saleId}?`)) {
      // implement delete in your data context
      alert('Deleted (mock). Implement deleteSale in context.');
    }
  };

  return (
    <div className="sales-page">
      <NewBillModal isOpen={isBillModalOpen} onClose={closeBillModal} products={products} customers={customers} onSaveBill={handleSaveBillFromModal} />
      <SaleDetailModal isOpen={isDetailModalOpen} onClose={closeDetailModal} sale={selectedSale} />

      <div className="page-header">
        <div className="header-title">
          <h1>Sales Management</h1>
          <p>Record multi-item bills and track transactions</p>
        </div>
        <button className="new-bill-button" onClick={openBillModal}><Plus size={18} /> New Bill</button>
      </div>

      <div className="sales-stat-grid">
        <StatCard title="Today's Bills" value={todayBillsCount} subValue="transactions" color="#8b5cf6" />
        {/* show revenue only to admins */}
        {isAdmin && <StatCard title="Today's Revenue" value={`₨ ${todayRevenue.toFixed(2)}`} subValue="total revenue" color="#10b981" />}
      </div>

      <div className="card sales-history-card">
        <div className="card-header">
          <div className="history-title">
            <ShoppingCart size={20} />
            <h2 className="card-title">Sales History ({(sales || []).length})</h2>
          </div>
        </div>

        <div className="card-content">
          {(sales || []).length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={48} className="empty-icon" />
              <p>No sales recorded yet</p>
              <button className="record-sale-button" onClick={openBillModal}><Plus size={18} /> Record Your First Sale</button>
            </div>
          ) : (
            <div className="sales-history-list">
              {(sales || []).slice(-10).reverse().map((s) => {
                const saleId = s.id ?? `sale-${s.date}`;
                return (
                  <div
                    key={saleId}
                    className="sale-row"
                    onClick={() => openDetailModal(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDetailModal(s); }}
                    aria-label={`Open sale ${saleId}`}
                  >
                    <div className="sale-details">
                      <div className="sale-id">#{typeof s.id === 'number' ? String(s.id).slice(-6) : 'N/A'}</div>
                      <div className="sale-meta">
                        <span>{new Date(s.date).toLocaleString()}</span>
                        <span>{s.customerName || 'Walk-in'} ({(s.lines || []).length} items)</span>
                      </div>
                    </div>

                    <div className="sale-actions">
                      <div className="sale-amount">{(isStaff && !isAdmin) ? '—' : `₨ ${(Number(s.totalAmount || 0)).toFixed(2)}`}</div>

                      {isAdmin && (
                        <button
                          type="button"
                          className="delete-sale-button"
                          onClick={(e) => handleDeleteSale(e, saleId)}
                          aria-label={`Delete sale ${saleId}`}
                          title="Delete sale"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
