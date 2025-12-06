// src/pages/sales.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/sales.css';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShoppingCart, X, Trash2, Edit2, FileText, Truck, AlertTriangle, RotateCcw } from 'lucide-react';

// --- Helper Components ---

function StatCard({ title, value, subValue, color }) {
  return (
    <div className="sales-stat-card" style={{ '--card-color': color }}>
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-subvalue">{subValue}</span>
      </div>
    </div>
  );
}

const fmtCurrency = (v) => `₨ ${Number(v || 0).toFixed(2)}`;

// --- Return Products Modal (NEW) ---

function ReturnModal({ isOpen, onClose, sale, onConfirm }) {
  const [returnMap, setReturnMap] = useState({}); // { lineId: qtyToReturn }
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setReturnMap({});
      setSaving(false);
    }
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  const handleQtyChange = (lineId, maxQty, val) => {
    let num = parseInt(val) || 0;
    if (num < 0) num = 0;
    if (num > maxQty) num = maxQty;
    
    setReturnMap(prev => ({
      ...prev,
      [lineId]: num
    }));
  };

  // Calculate total refund amount based on selection
  const totalRefund = (sale.lines || []).reduce((acc, line) => {
    const qty = returnMap[line.id] || 0;
    return acc + (qty * Number(line.unit_price));
  }, 0);

  const handleReturn = async () => {
    if (totalRefund <= 0) {
      alert("Please select at least one item to return.");
      return;
    }
    if (!confirm(`Process return and refund ${fmtCurrency(totalRefund)}? This will restore stock.`)) return;

    setSaving(true);
    try {
      // 1. Construct new lines array (reducing quantities)
      const updatedLines = sale.lines.map(line => {
        const returnQty = returnMap[line.id] || 0;
        const newQty = line.quantity - returnQty;
        
        // Return the line object formatted for the serializer
        return {
          id: line.id,
          product: line.product, // ID is needed
          quantity: newQty,      // The NEW reduced quantity
          unit_price: line.unit_price
        };
      }).filter(l => l.quantity > 0); // Remove lines that are fully returned (0 qty)

      // 2. Append a note to the sale history
      const today = new Date().toLocaleDateString();
      const returnNote = `\n[${today}] Returned items. Refund: ${fmtCurrency(totalRefund)}.`;
      const newNotes = (sale.notes || '') + returnNote;

      // 3. Recalculate totals
      const newTotal = updatedLines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);

      // 4. Send Payload
      const payload = {
        lines: updatedLines,
        notes: newNotes,
        total_amount: newTotal,
        subtotal: newTotal
      };

      const res = await api.patch(`/sales/${sale.id}/`, payload);
      onConfirm(res.data); // Refresh parent
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to process return. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="sales-modal-header">
          <h3>Return Products</h3>
          <button className="icon-btn" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="sales-modal-body">
          <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
            Select quantities to return. Stock will be restored automatically.
          </p>

          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{textAlign: 'center'}}>Sold</th>
                  <th style={{textAlign: 'center', width: '100px'}}>Return Qty</th>
                  <th style={{textAlign: 'right'}}>Refund Amt</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map(line => {
                  const returnQty = returnMap[line.id] || 0;
                  const refundAmt = returnQty * Number(line.unit_price);
                  return (
                    <tr key={line.id} style={{ backgroundColor: returnQty > 0 ? '#fff7ed' : 'transparent' }}>
                      <td>
                        <div style={{fontWeight: 600}}>{line.product_name}</div>
                        <div style={{fontSize: '0.8rem', color: '#9ca3af'}}>{fmtCurrency(line.unit_price)} each</div>
                      </td>
                      <td style={{textAlign: 'center'}}>{line.quantity}</td>
                      <td style={{textAlign: 'center'}}>
                        <input 
                          type="number" 
                          className="clean-input" 
                          style={{padding: '6px', textAlign: 'center'}}
                          value={returnQty}
                          onChange={(e) => handleQtyChange(line.id, line.quantity, e.target.value)}
                        />
                      </td>
                      <td style={{textAlign: 'right', fontWeight: 600, color: returnQty > 0 ? '#ea580c' : 'inherit'}}>
                        {fmtCurrency(refundAmt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sales-footer-summary">
            <div className="total-display">
              <span style={{color: '#ea580c'}}>Total Refund</span>
              <span className="amount" style={{color: '#ea580c'}}>{fmtCurrency(totalRefund)}</span>
            </div>
          </div>
        </div>
        <div className="sales-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{backgroundColor: '#ea580c'}} onClick={handleReturn} disabled={saving || totalRefund <= 0}>
            {saving ? 'Processing...' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Sale Detail Modal (UPDATED) ---

function SaleDetailModal({ isOpen, onClose, sale, onOpenReturn }) {
  if (!isOpen || !sale) return null;
  const get = (k) => sale[k] ?? sale[k === 'totalAmount' ? 'total_amount' : k];

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h3>Sale #{String(get('id') ?? '').slice(-6)}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="sales-modal-body">
          <div className="sales-info-grid">
            <div>
              <label>Date</label>
              <div>{sale.date ? new Date(sale.date).toLocaleString() : '—'}</div>
            </div>
            <div>
              <label>Customer</label>
              <div>{sale.customer_name || sale.customerName || 'Walk-in'}</div>
            </div>
            <div>
              <label>Vehicle Plate</label>
              <div style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                {sale.vehicle_number || sale.vehicleNumber || '—'}
              </div>
            </div>
            <div>
              <label>Payment</label>
              <div style={{ textTransform: 'capitalize' }}>{sale.payment_method || 'Cash'}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', marginTop: '-1rem' }}>
             {/* Return Button */}
             <button className="btn btn-secondary" onClick={() => onOpenReturn(sale)} style={{ fontSize: '0.85rem', padding: '8px 12px' }}>
                <RotateCcw size={16} style={{marginRight: 6}} /> Return Products
             </button>

             <div style={{ textAlign: 'right' }}>
               <label style={{fontSize: '0.8rem', color:'#6b7280', textTransform:'uppercase', fontWeight:600}}>Total Amount</label>
               <div className="sales-total-large">{fmtCurrency(get('total_amount'))}</div>
             </div>
          </div>

          <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Items</h4>
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(sale.lines || []).map((ln, i) => (
                  <tr key={i}>
                    <td>{ln.product_name || ln.productName || 'Item'}</td>
                    <td style={{ textAlign: 'center' }}>{ln.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(ln.unit_price)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(ln.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show Notes if they exist (e.g. Return history) */}
          {sale.notes && (
            <div style={{ marginTop: '20px', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <label style={{fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase'}}>Notes / History</label>
              <div style={{whiteSpace: 'pre-line', fontSize: '0.9rem', color: '#374151', marginTop: '4px'}}>
                {sale.notes}
              </div>
            </div>
          )}
        </div>

        <div className="sales-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// --- Create/Edit Modal (Existing) ---

function NewBillModal({ isOpen, onClose, products = [], customers = [], onSave, existing = null, saving = false }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [notes, setNotes] = useState('');
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lineUnitPrice, setLineUnitPrice] = useState('');
  const [priceWarning, setPriceWarning] = useState(null);

  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (existing) {
        setDate(existing.date ? existing.date.slice(0,10) : new Date().toISOString().slice(0,10));
        setCustomerId(existing.customer || '');
        setPaymentMethod(existing.payment_method || 'cash');
        setVehicleNumber(existing.vehicle_number || existing.vehicleNumber || '');
        setNotes(existing.notes || '');
        setLines((existing.lines || []).map(ln => ({
          uniqueId: Math.random(), 
          id: ln.id, 
          productId: ln.product,
          productName: ln.product_name || ln.productName,
          quantity: ln.quantity,
          unitPrice: ln.unit_price || ln.unitPrice
        })));
      } else {
        setDate(new Date().toISOString().slice(0,10));
        setCustomerId('');
        setPaymentMethod('cash');
        setVehicleNumber('');
        setNotes('');
        setLines([]);
      }
      setError('');
      setSelectedProductId('');
      setLineQty(1);
      setLineUnitPrice('');
      setPriceWarning(null);
    }
  }, [isOpen, existing]);

  useEffect(() => {
    const p = products.find(prod => String(prod.id) === String(selectedProductId));
    if (p) {
      setLineUnitPrice(p.selling_price || 0);
    } else {
      setLineUnitPrice('');
    }
  }, [selectedProductId, products]);

  useEffect(() => {
    setPriceWarning(null);
    if (!selectedProductId || !lineUnitPrice) return;
    const p = products.find(prod => String(prod.id) === String(selectedProductId));
    if (p) {
      const minPrice = parseFloat(p.minimum_selling_price || 0);
      const currentPrice = parseFloat(lineUnitPrice);
      if (minPrice > 0 && currentPrice < minPrice) {
        setPriceWarning(`Warning: Below minimum price (${fmtCurrency(minPrice)})`);
      }
    }
  }, [lineUnitPrice, selectedProductId, products]);

  function addLine() {
    if (!selectedProductId) return;
    const p = products.find(prod => String(prod.id) === String(selectedProductId));
    const newLine = {
      uniqueId: Math.random(),
      productId: p.id,
      productName: p.name,
      quantity: Number(lineQty),
      unitPrice: Number(lineUnitPrice)
    };
    setLines([...lines, newLine]);
    setSelectedProductId('');
    setLineQty(1);
    setLineUnitPrice('');
    setPriceWarning(null);
  }

  function removeLine(uniqueId) {
    setLines(lines.filter(l => l.uniqueId !== uniqueId));
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);

  async function handleSubmit() {
    if (lines.length === 0) {
      setError("Please add at least one item.");
      return;
    }
    const payload = {
      date,
      customer: customerId || null,
      payment_method: paymentMethod,
      vehicle_number: vehicleNumber || '',
      notes,
      total_amount: subtotal,
      lines: lines.map(l => ({
        id: l.id,
        product: l.productId,
        quantity: l.quantity,
        unit_price: l.unitPrice
      }))
    };

    try {
      if (existing) {
        const res = await api.patch(`/sales/${existing.id}/`, payload);
        onSave(res.data);
      } else {
        const res = await api.post('/sales/', payload);
        onSave(res.data);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save sale. Check inputs.");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="sales-modal-overlay">
      <div className="sales-modal" style={{ maxWidth: '850px' }}>
        <div className="sales-modal-header">
          <h3>{existing ? 'Edit Bill' : 'New Bill'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sales-modal-body">
          <div className="form-row">
            <div className="form-group" style={{flex: 0.5}}>
              <label>Date</label>
              <input type="date" className="clean-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{flex: 1.5}}>
              <label>Customer</label>
              <select className="clean-input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Walk-in Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Vehicle Plate # (Optional)</label>
              <div style={{position:'relative'}}>
                <input type="text" className="clean-input" placeholder="e.g. ABC-1234" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} style={{paddingLeft: '2.2rem'}} />
                <Truck size={16} style={{position:'absolute', left:'0.8rem', top:'50%', transform:'translateY(-50%)', color:'#9ca3af'}}/>
              </div>
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select className="clean-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="credit">Credit / Later</option>
              </select>
            </div>
          </div>
          <hr style={{border:0, borderTop:'1px solid #f3f4f6', margin:'1.5rem 0'}}/>
          <div className="add-line-box">
            <div className="form-group" style={{ flex: 2 }}>
              <select className="clean-input" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                <option value="">Select Product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''} (Stk: {p.quantity_in_stock})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 0.5 }}>
              <input type="number" className="clean-input" placeholder="Qty" value={lineQty} onChange={e => setLineQty(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <input type="number" className={`clean-input ${priceWarning ? 'warning-border' : ''}`} placeholder="Price" value={lineUnitPrice} onChange={e => setLineUnitPrice(e.target.value)} />
              {priceWarning && (
                <div style={{color: '#f59e0b', fontSize: '0.75rem', marginTop: '4px', display:'flex', alignItems:'center', gap:'4px'}}>
                  <AlertTriangle size={12}/> {priceWarning}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={addLine}><Plus size={16}/> Add</button>
          </div>
          <div className="sales-table-wrapper" style={{ maxHeight: '250px', minHeight: '150px' }}>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign:'center', color:'#999', padding:'2rem'}}>No items added yet.</td></tr>
                ) : (
                  lines.map(l => (
                    <tr key={l.uniqueId}>
                      <td>{l.productName}</td>
                      <td>{l.quantity}</td>
                      <td>{fmtCurrency(l.unitPrice)}</td>
                      <td>{fmtCurrency(l.quantity * l.unitPrice)}</td>
                      <td>
                        <button className="icon-btn danger" onClick={() => removeLine(l.uniqueId)}><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sales-footer-summary">
            <div style={{flex: 1, marginRight: '2rem'}}>
              <label>Notes</label>
              <input className="clean-input" style={{width: '100%'}} placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="total-display">
              <span>Grand Total</span>
              <span className="amount">{fmtCurrency(subtotal)}</span>
            </div>
          </div>
          {error && <div className="error-msg">{error}</div>}
        </div>
        <div className="sales-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function Sales() {
  const { user } = useAuth() || {};
  const isAdmin = user?.role === 'admin';
  
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  
  const [detailSale, setDetailSale] = useState(null);
  const [returnSale, setReturnSale] = useState(null); // State for return modal

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        api.get('/sales/'),
        api.get('/products/'),
        api.get('/customers/')
      ]);
      setSales(Array.isArray(sRes.data) ? sRes.data : sRes.data.results || []);
      setProducts(Array.isArray(pRes.data) ? pRes.data : pRes.data.results || []);
      setCustomers(Array.isArray(cRes.data) ? cRes.data : cRes.data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleSave(savedSale) {
    setSales(prev => {
      const exists = prev.find(s => s.id === savedSale.id);
      if (exists) return prev.map(s => s.id === savedSale.id ? savedSale : s);
      return [savedSale, ...prev];
    });
  }

  // Handle updates from Return modal
  function handleReturnUpdate(updatedSale) {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    // Also update the detail view if it's open
    if (detailSale && detailSale.id === updatedSale.id) {
      setDetailSale(updatedSale);
    }
  }

  async function deleteSale(id) {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      await api.delete(`/sales/${id}/`);
      setSales(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert("Failed to delete");
    }
  }

  const todayRevenue = sales
    .filter(s => new Date(s.date).toDateString() === new Date().toDateString())
    .reduce((acc, s) => acc + Number(s.total_amount), 0);

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1>Sales Dashboard</h1>
          <p>Manage bills and transactions</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingSale(null); setModalOpen(true); }}>
          <Plus size={18} style={{marginRight: 8}}/> New Bill
        </button>
      </div>

      <div className="sales-stats">
        <StatCard title="Today's Sales" value={sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length} subValue="Transactions" color="#4f46e5" />
        <StatCard title="Today's Revenue" value={fmtCurrency(todayRevenue)} subValue="Gross" color="#10b981" />
      </div>

      <div className="sales-list-card">
        <div className="card-header">
          <h3>Recent Transactions</h3>
        </div>
        <div className="sales-table-wrapper">
          <table className="sales-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Payment</th>
                <th>Amount</th>
                <th style={{textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7">Loading...</td></tr> : sales.map(s => (
                <tr key={s.id} onClick={() => setDetailSale(s)} className="clickable-row">
                  <td className="mono-font">#{String(s.sale_no || s.id).slice(-6)}</td>
                  <td>{new Date(s.date).toLocaleDateString()}</td>
                  <td>{s.customer_name || 'Walk-in'}</td>
                  <td style={{fontSize: '0.85rem', color:'#666'}}>{s.vehicle_number || '-'}</td>
                  <td style={{textTransform: 'capitalize'}}>{s.payment_method}</td>
                  <td style={{fontWeight: 'bold'}}>{fmtCurrency(s.total_amount)}</td>
                  <td style={{textAlign: 'right'}} onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <>
                        <button className="icon-btn" onClick={() => { setEditingSale(s); setModalOpen(true); }}>
                          <Edit2 size={16}/>
                        </button>
                        <button className="icon-btn danger" onClick={() => deleteSale(s.id)}>
                          <Trash2 size={16}/>
                        </button>
                      </>
                    )}
                    {!isAdmin && <button className="icon-btn"><FileText size={16}/></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewBillModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        existing={editingSale}
        products={products}
        customers={customers}
        onSave={handleSave}
      />

      {/* Sale Detail Modal now passes a handler to open Return Modal */}
      <SaleDetailModal 
        isOpen={!!detailSale} 
        onClose={() => setDetailSale(null)} 
        sale={detailSale} 
        onOpenReturn={(s) => setReturnSale(s)}
      />

      {/* The New Return Modal */}
      <ReturnModal 
        isOpen={!!returnSale}
        onClose={() => setReturnSale(null)}
        sale={returnSale}
        onConfirm={handleReturnUpdate}
      />
    </div>
  );
}