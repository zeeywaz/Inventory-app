// src/pages/sales.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../styles/sales.css';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext'; 
import { Plus, ShoppingCart, X, Trash2, Edit2, FileText, Truck, AlertTriangle, RotateCcw, Lock, UserPlus, UserCog } from 'lucide-react';

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

// --- Quick Customer Add/Edit Modal (Updated) ---
function QuickCustomerModal({ isOpen, onClose, onSuccess, customerToEdit = null }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  // Reset or Populate form
  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setForm({
          name: customerToEdit.name || '',
          phone: customerToEdit.phone || '',
          email: customerToEdit.email || '',
          address: customerToEdit.address || '',
        });
      } else {
        setForm({ name: '', phone: '', email: '', address: '' });
      }
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!form.name || !form.phone) return alert("Name and Phone are required.");
    setSaving(true);
    try {
      let res;
      if (customerToEdit) {
        // EDIT Existing Customer
        res = await api.patch(`/customers/${customerToEdit.id}/`, form);
      } else {
        // CREATE New Customer
        res = await api.post('/customers/', form);
      }
      onSuccess(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save customer: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    // FIX: High Z-Index to appear ABOVE the Bill Modal
    <div className="sales-modal-overlay" onClick={onClose} style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
      <div className="sales-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="sales-modal-header">
          <h3>{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="sales-modal-body">
          {/* Row 1: Name & Phone */}
          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>Name <span style={{color:'red'}}>*</span></label>
              <input 
                className="clean-input" 
                autoFocus 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="Customer Name" 
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Phone <span style={{color:'red'}}>*</span></label>
              <input 
                className="clean-input" 
                value={form.phone} 
                onChange={e => setForm({...form, phone: e.target.value})} 
                placeholder="077..." 
              />
            </div>
          </div>

          {/* Row 2: Email */}
          <div className="form-group" style={{marginTop: 12}}>
            <label>Email</label>
            <input 
              className="clean-input" 
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})} 
              placeholder="optional@email.com" 
            />
          </div>

          {/* Row 3: Address (Full Width) */}
          <div className="form-group" style={{marginTop: 12}}>
            <label>Address</label>
            <input 
              className="clean-input" 
              value={form.address} 
              onChange={e => setForm({...form, address: e.target.value})} 
              placeholder="House No, Street, City" 
            />
          </div>
        </div>
        
        <div className="sales-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (customerToEdit ? 'Update Customer' : 'Create Customer')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ... (Rest of the file: ReturnModal, SaleDetailModal, NewBillModal, Sales component remain unchanged from previous step)
// Ensure you include the full file content if you are copy-pasting the entire file.

function ReturnModal({ isOpen, onClose, sale, onConfirm }) {
  const [returnMap, setReturnMap] = useState({}); 
  const [saving, setSaving] = useState(false);

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
    setReturnMap(prev => ({ ...prev, [lineId]: num }));
  };

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
      const updatedLines = sale.lines.map(line => {
        const returnQty = returnMap[line.id] || 0;
        const newQty = line.quantity - returnQty;
        return {
          id: line.id,
          product: line.product,
          quantity: newQty,
          unit_price: line.unit_price
        };
      }).filter(l => l.quantity > 0); 

      const today = new Date().toLocaleDateString();
      const returnNote = `\n[${today}] Returned items. Refund: ${fmtCurrency(totalRefund)}.`;
      const newNotes = (sale.notes || '') + returnNote;
      const newTotal = updatedLines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);

      const payload = {
        lines: updatedLines,
        notes: newNotes,
        total_amount: newTotal,
        subtotal: newTotal
      };

      const res = await api.patch(`/sales/${sale.id}/`, payload);
      onConfirm(res.data);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to process return. Check console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
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

function SaleDetailModal({ isOpen, onClose, sale, onOpenReturn }) {
  if (!isOpen || !sale) return null;
  const get = (k) => sale[k] ?? sale[k === 'totalAmount' ? 'total_amount' : k];

  return (
    <div className="sales-modal-overlay" onClick={onClose} style={{ zIndex: 9000 }}>
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

function NewBillModal({ isOpen, onClose, products = [], customers = [], onSave, onAddCustomer, onUpdateCustomer, existing = null, saving = false }) {
  const { user } = useAuth();
  const { settings } = useSettings(); 
  const isAdmin = user?.role === 'admin';

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
  
  // Customer Modal States
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);

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

  // --- Walk-in Logic (No Credit) ---
  useEffect(() => {
    if (!customerId && paymentMethod === 'credit') {
        setPaymentMethod('cash');
    }
  }, [customerId, paymentMethod]);

  // Update unit price when product selected
  useEffect(() => {
    const p = products.find(prod => String(prod.id) === String(selectedProductId));
    if (p) {
      setLineUnitPrice(p.selling_price || 0);
    } else {
      setLineUnitPrice('');
    }
  }, [selectedProductId, products]);

  // Watch for price changes (Warning Logic)
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

  const handlePriceChange = (e) => {
    const newVal = e.target.value;
    
    // Check if permission required
    if (settings.requireAdminApproval && !isAdmin) {
      const p = products.find(prod => String(prod.id) === String(selectedProductId));
      const originalPrice = p ? p.selling_price : 0;
      
      if (newVal !== '' && Number(newVal) !== Number(originalPrice)) {
         alert("Admin approval required to change price. Please ask a manager.");
         setLineUnitPrice(originalPrice); 
         return;
      }
    }
    setLineUnitPrice(newVal);
  };

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

  // --- Customer Modal Handlers ---
  
  const handleOpenAddCustomer = () => {
    setCustomerToEdit(null);
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = () => {
    if (!customerId) return;
    const cust = customers.find(c => String(c.id) === String(customerId));
    if (cust) {
      setCustomerToEdit(cust);
      setCustomerModalOpen(true);
    }
  };

  const handleCustomerSuccess = (customer) => {
    if (customerToEdit) {
      // It was an edit
      onUpdateCustomer(customer);
    } else {
      // It was a new creation
      onAddCustomer(customer);
      setCustomerId(customer.id); // Auto-select new customer
    }
  };

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
    <>
      {/* Bill Modal */}
      <div className="sales-modal-overlay" style={{zIndex: 9000}}>
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
                <div style={{display:'flex', gap: 8}}>
                    <select className="clean-input" style={{flex:1}} value={customerId} onChange={e => setCustomerId(e.target.value)}>
                        <option value="">Walk-in Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    
                    {/* Add Customer Button */}
                    <button className="btn btn-secondary" onClick={handleOpenAddCustomer} title="Add New Customer">
                        <UserPlus size={16} />
                    </button>

                    {/* Edit Customer Button (Only if customer selected) */}
                    {customerId && (
                      <button className="btn btn-secondary" onClick={handleOpenEditCustomer} title="Edit Selected Customer">
                          <UserCog size={16} />
                      </button>
                    )}
                </div>
                </div>
            </div>

            <div className="form-row">
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
                    {/* Disable Credit if no customer selected */}
                    <option value="credit" disabled={!customerId}>
                        Credit / Later {!customerId ? '(Reg. Only)' : ''}
                    </option>
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
                <div style={{position:'relative'}}>
                    <input 
                        type="number" 
                        className={`clean-input ${priceWarning ? 'warning-border' : ''}`} 
                        placeholder="Price" 
                        value={lineUnitPrice} 
                        onChange={handlePriceChange} 
                    />
                    {settings.requireAdminApproval && !isAdmin && (
                        <Lock size={14} style={{position:'absolute', right: 10, top: 12, color:'#9ca3af'}} />
                    )}
                </div>
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

      {/* Nested Modal for Quick Add/Edit Customer */}
      <QuickCustomerModal 
          isOpen={isCustomerModalOpen} 
          onClose={() => setCustomerModalOpen(false)}
          onSuccess={handleCustomerSuccess}
          customerToEdit={customerToEdit}
      />
    </>
  );
}

// --- Main Page ---

export default function Sales() {
  const { user } = useAuth() || {};
  const { settings } = useSettings(); 
  const isAdmin = user?.role === 'admin';
  
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  
  const [detailSale, setDetailSale] = useState(null);
  const [returnSale, setReturnSale] = useState(null); 

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

  // --- Handlers for Customer Updates ---
  function handleCustomerAdd(newCustomer) {
    setCustomers(prev => [newCustomer, ...prev]);
  }

  function handleCustomerUpdate(updatedCustomer) {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
  }

  function handleReturnUpdate(updatedSale) {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
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
              {loading ? <tr><td colSpan="7">Loading...</td></tr> : sales.map(s => {
                const total = Number(s.total_amount);
                const isHidden = !isAdmin && settings.hideBillThreshold > 0 && total > settings.hideBillThreshold;

                return (
                  <tr key={s.id} onClick={() => !isHidden && setDetailSale(s)} className={isHidden ? "" : "clickable-row"} style={{opacity: isHidden ? 0.5 : 1}}>
                    <td className="mono-font">#{String(s.sale_no || s.id).slice(-6)}</td>
                    <td>{new Date(s.date).toLocaleDateString()}</td>
                    <td>{isHidden ? '******' : (s.customer_name || 'Walk-in')}</td>
                    <td style={{fontSize: '0.85rem', color:'#666'}}>{s.vehicle_number || '-'}</td>
                    <td style={{textTransform: 'capitalize'}}>{s.payment_method}</td>
                    <td style={{fontWeight: 'bold'}}>
                      {isHidden ? <span style={{color:'#999', fontStyle:'italic'}}>Hidden</span> : fmtCurrency(s.total_amount)}
                    </td>
                    <td style={{textAlign: 'right'}} onClick={e => e.stopPropagation()}>
                      {!isHidden && (
                        <>
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
                          {!isAdmin && <button className="icon-btn" onClick={() => setDetailSale(s)}><FileText size={16}/></button>}
                        </>
                      )}
                      {isHidden && <Lock size={16} color="#ccc" />}
                    </td>
                  </tr>
                );
              })}
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
        onAddCustomer={handleCustomerAdd} 
        onUpdateCustomer={handleCustomerUpdate} // Pass update handler
      />

      <SaleDetailModal 
        isOpen={!!detailSale} 
        onClose={() => setDetailSale(null)} 
        sale={detailSale} 
        onOpenReturn={(s) => setReturnSale(s)}
      />

      <ReturnModal 
        isOpen={!!returnSale}
        onClose={() => setReturnSale(null)}
        sale={returnSale}
        onConfirm={handleReturnUpdate}
      />
    </div>
  );
}