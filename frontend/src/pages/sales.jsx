// src/pages/sales.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/sales.css';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShoppingCart, X, Trash2, Edit2, FileText, Truck } from 'lucide-react';

// --- Helper Components ---

function StatCard({ title, value, subValue, color }) {
  return (
    // We pass the color as a CSS variable ('--card-color') 
    // so the CSS ::before element can read it.
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

// --- Sale Detail Modal ---

function SaleDetailModal({ isOpen, onClose, sale }) {
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
            {/* NEW: Vehicle Display */}
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
          
          <div style={{ textAlign: 'right', marginTop: '-1rem', marginBottom: '1rem' }}>
             <label style={{fontSize: '0.8rem', color:'#6b7280', textTransform:'uppercase', fontWeight:600}}>Total Amount</label>
             <div className="sales-total-large">{fmtCurrency(get('total_amount'))}</div>
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
        </div>

        <div className="sales-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// --- Create/Edit Modal ---

function NewBillModal({ isOpen, onClose, products = [], customers = [], onSave, existing = null, saving = false }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  // NEW: Vehicle State
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [notes, setNotes] = useState('');
  
  // Line item states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lineUnitPrice, setLineUnitPrice] = useState('');
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (existing) {
        setDate(existing.date ? existing.date.slice(0,10) : new Date().toISOString().slice(0,10));
        setCustomerId(existing.customer || '');
        setPaymentMethod(existing.payment_method || 'cash');
        // NEW: Load existing vehicle number
        setVehicleNumber(existing.vehicle_number || existing.vehicleNumber || '');
        setNotes(existing.notes || '');
        setLines((existing.lines || []).map(ln => ({
          uniqueId: Math.random(), // frontend key
          id: ln.id, // backend ID for updates
          productId: ln.product,
          productName: ln.product_name || ln.productName,
          quantity: ln.quantity,
          unitPrice: ln.unit_price || ln.unitPrice
        })));
      } else {
        // Reset for new bill
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
    }
  }, [isOpen, existing]);

  // Update unit price when product selected
  useEffect(() => {
    const p = products.find(prod => String(prod.id) === String(selectedProductId));
    if (p) setLineUnitPrice(p.selling_price || 0);
  }, [selectedProductId, products]);

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
      // NEW: Send vehicle number
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
          {/* Top Form - Organized into 2 Rows for cleaner look */}
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
            {/* NEW: Vehicle Plate Input */}
            <div className="form-group">
              <label>Vehicle Plate # (Optional)</label>
              <div style={{position:'relative'}}>
                <input 
                  type="text" 
                  className="clean-input" 
                  placeholder="e.g. ABC-1234" 
                  value={vehicleNumber} 
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())} 
                  style={{paddingLeft: '2.2rem'}}
                />
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

          {/* Add Line Section */}
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
              <input type="number" className="clean-input" placeholder="Price" value={lineUnitPrice} onChange={e => setLineUnitPrice(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addLine}><Plus size={16}/> Add</button>
          </div>

          {/* Lines Table */}
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
                  {/* NEW: Vehicle Column in List */}
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

      <SaleDetailModal 
        isOpen={!!detailSale} 
        onClose={() => setDetailSale(null)} 
        sale={detailSale} 
      />
    </div>
  );
}