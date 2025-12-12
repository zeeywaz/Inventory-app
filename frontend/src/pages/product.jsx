// src/pages/product.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/product.css';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext'; // <--- Import Settings
import api from '../api'; 
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Box,
  Edit3,
} from 'lucide-react';

/* ---------------------------
   Helpers & small components
   --------------------------- */

function StatCard({ title, value, colorClass }) {
  return (
    <div className={`pi-stat-card ${colorClass || ''}`}>
      <div className="pi-stat-title">{title}</div>
      <div className="pi-stat-value">{value}</div>
    </div>
  );
}

/* ---------------------------
   Modals
   --------------------------- */

function EditProductModal({ open, product = null, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    quantity_in_stock: 0,
    cost_price: '',
    selling_price: '',
    min_selling_price: '',
    vehicle: '',
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        quantity_in_stock: product.quantity_in_stock ?? 0,
        cost_price: product.cost_price ?? '',
        selling_price: product.selling_price ?? '',
        min_selling_price: product.minimum_selling_price ?? product.min_selling_price ?? '',
        vehicle: product.vehicle || '',
      });
    } else {
      setForm({
        name: '',
        sku: '',
        quantity_in_stock: 0,
        cost_price: '',
        selling_price: '',
        min_selling_price: '',
        vehicle: '',
      });
    }
  }, [product, open]);

  if (!open) return null;

  function updateField(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleSave() {
    if (!form.name || !form.sku) {
      alert('Product name and SKU are required.');
      return;
    }
    const payload = {
      name: form.name,
      sku: form.sku,
      quantity_in_stock: Number(form.quantity_in_stock || 0),
      cost_price: form.cost_price === '' ? 0 : Number(form.cost_price),
      selling_price: form.selling_price === '' ? 0 : Number(form.selling_price),
      minimum_selling_price: form.min_selling_price === '' ? 0 : Number(form.min_selling_price),
      vehicle: form.vehicle || null,
    };
    onSave(payload);
  }

  return (
    <div className="pi-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pi-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pi-modal-header">
          <h3>{product ? 'Edit Product' : 'Add Product'}</h3>
          <button className="pi-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <main className="pi-modal-body">
          <label className="pi-field">
            <div className="pi-field-label">Product name</div>
            <input value={form.name} onChange={updateField('name')} placeholder="e.g. Carbon Fiber Hood" />
          </label>

          <div className="pi-row">
            <label className="pi-field">
              <div className="pi-field-label">SKU</div>
              <input value={form.sku} onChange={updateField('sku')} placeholder="CF-HOOD-001" />
            </label>
          </div>

          <div className="pi-row">
            <label className="pi-field">
              <div className="pi-field-label">Stock</div>
              <input type="number" value={form.quantity_in_stock} onChange={updateField('quantity_in_stock')} min="0" />
            </label>

            <label className="pi-field">
              <div className="pi-field-label">Vehicle</div>
              <input value={form.vehicle} onChange={updateField('vehicle')} placeholder="Honda Civic 2016-2021" />
            </label>
          </div>

          <div className="pi-row">
            <label className="pi-field">
              <div className="pi-field-label">Cost price</div>
              <input type="number" value={form.cost_price} onChange={updateField('cost_price')} min="0" step="0.01" />
            </label>

            <label className="pi-field">
              <div className="pi-field-label">Selling price</div>
              <input type="number" value={form.selling_price} onChange={updateField('selling_price')} min="0" step="0.01" />
            </label>

            <label className="pi-field">
              <div className="pi-field-label">Min price</div>
              <input type="number" value={form.min_selling_price} onChange={updateField('min_selling_price')} min="0" step="0.01" />
            </label>
          </div>
        </main>

        <footer className="pi-modal-footer">
          <button className="btn btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{product ? 'Save' : 'Add product'}</button>
        </footer>
      </div>
    </div>
  );
}

function EditStockModal({ open, product, onClose, onSaveStock }) {
  const [qty, setQty] = useState(0);
  useEffect(()=> {
    if (product) setQty(product.quantity_in_stock ?? 0);
  }, [product, open]);

  if (!open) return null;
  return (
    <div className="pi-modal-overlay" onClick={onClose}>
      <div className="pi-modal" onClick={(e)=> e.stopPropagation()}>
        <header className="pi-modal-header">
          <h3>Edit stock — {product?.name}</h3>
          <button className="pi-modal-close" onClick={onClose}>✕</button>
        </header>
        <main className="pi-modal-body">
          <label className="pi-field">
            <div className="pi-field-label">Quantity in stock</div>
            <input type="number" min="0" value={qty} onChange={(e)=> setQty(Number(e.target.value || 0))} />
          </label>
        </main>
        <footer className="pi-modal-footer">
          <button className="btn btn-muted" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSaveStock({ productId: product?.id, quantity_in_stock: Number(qty) })}>Save stock</button>
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------
   Main Page
   --------------------------- */

export default function ProductsPage() {
  const { user, role } = useAuth() || {}; 
  const { settings } = useSettings(); // <--- 1. Get Settings
  
  const isAdmin = role === 'admin' || user?.role === 'admin';
  const isStaff = role === 'staff' || user?.role === 'staff';

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- Logic to check visibility ---
  // If settings say "Show Cost to Staff", then staff can see it. Admins always see it.
  const showCost = isAdmin || settings.showCostToStaff;
  
  // If settings say "Staff Can Edit Stock Only", then disable full edit for staff.
  // Admins always have full edit.
  const canEditDetails = isAdmin || !settings.staffCanEditStockOnly;

  // --- API Helpers ---
  const apiGet = async (path, params = {}) => {
    const resp = await api.get(path, { params });
    return resp.data;
  };
  const apiPost = async (path, body) => {
    const resp = await api.post(path, body);
    return resp.data;
  };
  const apiPatch = async (path, body) => {
    const resp = await api.patch(path, body);
    return resp.data;
  };
  const apiDelete = async (path) => {
    const resp = await api.delete(path);
    return resp;
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/products/');
      const items = Array.isArray(data) ? data : (data?.results ?? data?.data ?? []);
      setProducts(items);
    } catch (err) {
      console.error('Failed fetching products', err);
      const backendMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message || String(err);
      alert('Could not fetch products from backend. ' + backendMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(products); return; }
    setFiltered(products.filter(p => {
      return (
        (p.name || '').toString().toLowerCase().includes(q) ||
        (p.sku || '').toString().toLowerCase().includes(q) ||
        (p.vehicle || '').toString().toLowerCase().includes(q)
      );
    }));
  }, [search, products]);

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => (p.quantity_in_stock ?? 0) > 0).length;
    const low = products.filter(p => {
      const stock = (p.quantity_in_stock ?? 0);
      const threshold = (p.reorder_level ?? p.low_stock_threshold ?? 5);
      return stock > 0 && stock <= threshold;
    }).length;
    const out = products.filter(p => (p.quantity_in_stock ?? 0) === 0).length;
    return { total, inStock, low, out };
  }, [products]);

  function openAddProduct() {
    setSelectedProduct(null);
    setEditModalOpen(true);
  }
  function openEditProduct(product) {
    setSelectedProduct(product);
    setEditModalOpen(true);
  }
  function openStockModal(product) {
    setSelectedProduct(product);
    setStockModalOpen(true);
  }

  // --- API Actions ---

  async function createProduct(payload) {
    const body = {
      name: payload.name,
      sku: payload.sku,
      quantity_in_stock: payload.quantity_in_stock,
      cost_price: payload.cost_price,
      selling_price: payload.selling_price,
      minimum_selling_price: payload.minimum_selling_price ?? payload.min_selling_price ?? 0,
      vehicle: payload.vehicle ?? null,
    };
    try {
      const created = await apiPost('/products/', body);
      setProducts(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('createProduct error', err);
      const msg = err?.response?.data?.detail || err?.response?.data || err.message || String(err);
      throw new Error(msg);
    }
  }

  async function updateProduct(id, patch) {
    const body = { ...patch };
    if (body.min_selling_price !== undefined) {
      body.minimum_selling_price = body.min_selling_price;
      delete body.min_selling_price;
    }
    if (body.vehicle === undefined && body.vehicle_for !== undefined) {
      body.vehicle = body.vehicle_for;
      delete body.vehicle_for;
    }

    try {
      const updated = await apiPatch(`/products/${id}/`, body);
      setProducts(prev => prev.map(p => (String(p.id) === String(id) ? updated : p)));
      return updated;
    } catch (err) {
      console.error('updateProduct error', err);
      const msg = err?.response?.data?.detail || err?.response?.data || err.message || String(err);
      throw new Error(msg);
    }
  }

  async function deleteProduct(id) {
    try {
      await apiDelete(`/products/${id}/`);
      setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
      return true;
    } catch (err) {
      console.error('deleteProduct error', err);
      const msg = err?.response?.data?.detail || err?.response?.data || err.message || String(err);
      throw new Error(msg);
    }
  }

  async function updateStock(productId, { quantity_in_stock }) {
    try {
      // OPTIMIZED: Send the new quantity directly. 
      // The server will calculate the difference (delta) and record the movement.
      // This avoids the extra GET request that was causing 401 errors.
      await apiPost(`/products/${productId}/adjust-stock/`, { 
        new_quantity: Number(quantity_in_stock), 
        reason: 'Stock updated via UI' 
      });

      // Refresh list
      await loadProducts();
      
      // Close modal and notify
      alert('Stock updated');
      setStockModalOpen(false);

    } catch (err) {
      console.error('updateStock error', err);
      // Fallback: If adjust-stock endpoint isn't updated yet, try the old patch method
      try {
          console.warn("Trying fallback patch...");
          await apiPatch(`/products/${productId}/`, { quantity_in_stock: Number(quantity_in_stock) });
          await loadProducts();
          setStockModalOpen(false);
      } catch (fallbackErr) {
          const msg = err?.response?.data?.detail || err.message || "Failed to update";
          alert('Stock update failed: ' + msg);
      }
    }
  }

  // --- Handlers ---

  async function handleSaveProduct(payload) {
    try {
      if (selectedProduct && selectedProduct.id) {
        if (!canEditDetails) { alert('Only admins can edit product details.'); return; }
        await updateProduct(selectedProduct.id, payload);
        alert('Saved');
      } else {
        if (!isAdmin) { alert('Only admins can create products.'); return; }
        await createProduct(payload);
        alert('Product added');
      }
      setEditModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + (err.message || err));
    }
  }

  async function handleSaveStock({ productId, quantity_in_stock }) {
    try {
      if (!isAdmin && !isStaff) { alert('Not authorized to edit stock'); return; }
      await updateStock(productId, { quantity_in_stock });
      alert('Stock updated');
      setStockModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Stock update failed: ' + (err.message || err));
    }
  }

  async function handleDelete(product) {
    if (!isAdmin) return alert('Only admins can delete products.');
    if (!window.confirm(`Delete product "${product.name}" (SKU: ${product.sku})? This cannot be undone.`)) return;
    try {
      await deleteProduct(product.id);
      alert('Deleted');
    } catch (err) {
      console.error(err);
      alert('Delete failed: ' + (err.message || err));
    }
  }

  const displayed = filtered;

  return (
    <div className="pi-page">
      <div className="pi-header">
        <div>
          <h2>Products & Inventory</h2>
          <p className="pi-sub">Manage your product catalog and stock levels</p>
        </div>

        <div className="pi-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddProduct}>
              <Plus size={14} /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="pi-stats-row">
        <StatCard title="Total Products" value={stats.total} colorClass="c-purple" />
        <StatCard title="In Stock" value={stats.inStock} colorClass="c-green" />
        <StatCard title="Low Stock" value={stats.low} colorClass="c-orange" />
        <StatCard title="Out of Stock" value={stats.out} colorClass="c-red" />
      </div>

      <div className="pi-search-row">
        <div className="pi-search">
          <Search size={18} className="pi-search-icon" />
          <input placeholder="Search products by name, SKU, or vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="pi-table-card card">
        <div className="pi-table-header">
          <div className="pi-table-title"><Box size={16} /> Product List ({displayed.length})</div>
        </div>

        <div className="pi-table-wrap">
          <table className="pi-table" role="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Stock</th>
                {/* 2. Condition for Cost Column */}
                {showCost && <th>Cost</th>}
                <th>Price</th>
                <th>Min Price</th>
                <th>Vehicle</th>
                <th className="pi-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={showCost ? 8 : 7} className="pi-empty">Loading products...</td></tr>
              )}

              {!loading && displayed.map((p) => {
                const stock = p.quantity_in_stock ?? 0;
                const lowThreshold = p.reorder_level ?? p.low_stock_threshold ?? 5;
                const minPrice = p.minimum_selling_price ?? p.min_selling_price ?? 0;
                return (
                  <tr key={p.id} className={stock === 0 ? 'out' : stock <= lowThreshold ? 'low' : ''}>
                    <td className="pi-prodcol">
                      <div className="pi-prod-name">{p.name}</div>
                    </td>
                    <td>{p.sku || '—'}</td>
                    <td>
                      <div className="pi-stock-wrap">
                        <span className="pi-stock-count">{stock}</span>
                        <button title="Edit stock" className="icon-btn" onClick={() => openStockModal(p)}><Edit3 size={14} /></button>
                      </div>
                    </td>

                    {/* 2. Condition for Cost Cell */}
                    {showCost && <td>₨ {Number(p.cost_price ?? 0).toFixed(2)}</td>}

                    <td>₨ {Number(p.selling_price ?? 0).toFixed(2)}</td>
                    <td className="pi-min-price">₨ {Number(minPrice).toFixed(2)}</td>
                    <td>{p.vehicle ?? 'Universal'}</td>

                    <td className="pi-actions-col">
                       {/* 3. Logic for Edit Button Visibility */}
                      {canEditDetails ? (
                        <>
                          <button className="icon-btn" title="Edit product" onClick={() => openEditProduct(p)}><Edit2 size={16} /></button>
                          {isAdmin && <button className="icon-btn danger" title="Delete product" onClick={() => handleDelete(p)}><Trash2 size={16} /></button>}
                        </>
                      ) : (
                        // If cannot edit details, show simple Stock button or nothing
                        <button className="icon-btn" title="View / edit stock" onClick={() => openStockModal(p)}><Edit3 size={16} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={showCost ? 8 : 7} className="pi-empty">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditProductModal open={editModalOpen} product={selectedProduct} onClose={() => setEditModalOpen(false)} onSave={handleSaveProduct} />
      <EditStockModal open={stockModalOpen} product={selectedProduct} onClose={() => setStockModalOpen(false)} onSaveStock={handleSaveStock} />
    </div>
  );
}