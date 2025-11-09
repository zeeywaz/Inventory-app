// src/pages/ProductsPage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import '../styles/product.css';
import { useAuth } from '../contexts/AuthContext';
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

function CategoryBadge({ children }) {
  return <span className="pi-badge">{children}</span>;
}

/* ---------------------------
   Modals (unchanged markup, wired to callbacks)
   --------------------------- */

function EditProductModal({ open, product = null, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    quantity_in_stock: 0,
    cost_price: '',
    selling_price: '',
    min_selling_price: '',
    vehicle_for: '',
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        category: product.category || '',
        quantity_in_stock: product.quantity_in_stock ?? 0,
        cost_price: product.cost_price ?? '',
        selling_price: product.selling_price ?? '',
        min_selling_price: product.minimum_selling_price ?? product.min_selling_price ?? '',
        vehicle_for: product.vehicle_for || product.vehicle || '',
      });
    } else {
      setForm({
        name: '',
        sku: '',
        category: '',
        quantity_in_stock: 0,
        cost_price: '',
        selling_price: '',
        min_selling_price: '',
        vehicle_for: '',
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
      category: form.category || null,
      quantity_in_stock: Number(form.quantity_in_stock || 0),
      cost_price: form.cost_price === '' ? 0 : Number(form.cost_price),
      selling_price: form.selling_price === '' ? 0 : Number(form.selling_price),
      minimum_selling_price: form.min_selling_price === '' ? 0 : Number(form.min_selling_price),
      vehicle_for: form.vehicle_for || null,
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

            <label className="pi-field">
              <div className="pi-field-label">Category</div>
              <input value={form.category} onChange={updateField('category')} placeholder="Body Kit" />
            </label>
          </div>

          <div className="pi-row">
            <label className="pi-field">
              <div className="pi-field-label">Stock</div>
              <input type="number" value={form.quantity_in_stock} onChange={updateField('quantity_in_stock')} min="0" />
            </label>

            <label className="pi-field">
              <div className="pi-field-label">Vehicle</div>
              <input value={form.vehicle_for} onChange={updateField('vehicle_for')} placeholder="Honda Civic 2016-2021" />
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
   Main Page (wired to backend)
   --------------------------- */

export default function ProductsPage() {
  const { user, token, role } = useAuth() || {}; // expects your AuthContext to expose token and role
  const isAdmin = role === 'admin' || user?.role === 'admin';
  const isStaff = role === 'staff' || user?.role === 'staff';

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // base API helper (attach bearer token if available)
  const apiFetch = async (path, opts = {}) => {
    const base = window.__BACKEND_BASE_URL__ || ''; // optional global base
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, { credentials: 'same-origin', ...opts, headers });
    if (!res.ok) {
      const text = await res.text().catch(()=>null);
      let err = text || res.statusText || `HTTP ${res.status}`;
      throw new Error(err);
    }
    // Return parsed JSON when possible
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return null;
  };

  // fetch products
  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/products/');
      // backend likely returns { results: [...]} when using pagination; handle both
      const items = Array.isArray(data) ? data : (data?.results ?? data?.data ?? []);
      setProducts(items);
    } catch (err) {
      console.error('Failed fetching products', err);
      // fallback: keep existing products (or empty)
      alert('Could not fetch products from backend. Check server and CORS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []); // once

  // search/filter
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(products); return; }
    setFiltered(products.filter(p => {
      return (
        (p.name || '').toString().toLowerCase().includes(q) ||
        (p.sku || '').toString().toLowerCase().includes(q) ||
        (p.category || '').toString().toLowerCase().includes(q) ||
        (p.vehicle_for || p.vehicle || '').toString().toLowerCase().includes(q)
      );
    }));
  }, [search, products]);

  // stats
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

  /* ---------------------------
     API mutation helpers
     --------------------------- */

  async function createProduct(payload) {
    // map to backend names: minimum_selling_price etc.
    const body = {
      name: payload.name,
      sku: payload.sku,
      category: payload.category,
      quantity_in_stock: payload.quantity_in_stock,
      cost_price: payload.cost_price,
      selling_price: payload.selling_price,
      minimum_selling_price: payload.minimum_selling_price ?? payload.min_selling_price ?? 0,
      vehicle_for: payload.vehicle_for,
    };
    const newProd = await apiFetch('/api/products/', { method: 'POST', body: JSON.stringify(body) });
    // append returned product
    const created = Array.isArray(newProd) ? newProd[0] : newProd;
    setProducts(prev => [created, ...prev]);
    return created;
  }

  async function updateProduct(id, patch) {
    // Admin: can patch any field. Staff should not call this method (UI prevents it).
    const body = { ...patch };
    // map possible client keys to backend keys
    if (body.min_selling_price !== undefined) {
      body.minimum_selling_price = body.min_selling_price;
      delete body.min_selling_price;
    }
    const updated = await apiFetch(`/api/products/${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
    setProducts(prev => prev.map(p => (String(p.id) === String(id) ? updated : p)));
    return updated;
  }

  async function deleteProduct(id) {
    await apiFetch(`/api/products/${id}/`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
    return true;
  }

  async function updateStock(productId, { quantity_in_stock }) {
    // We use the adjust-stock endpoint — this will create inventory movement on backend
    try {
      // compute change: need current product quantity
      const existing = products.find(p => String(p.id) === String(productId));
      const currentQty = existing ? (existing.quantity_in_stock ?? 0) : 0;
      const change = Number(quantity_in_stock) - Number(currentQty);

      // If backend supports direct PATCH to product for staff you could do:
      // await apiFetch(`/api/products/${productId}/`, { method: 'PATCH', body: JSON.stringify({ quantity_in_stock }) });

      // preferable: call adjust-stock with integer change
      await apiFetch(`/api/products/${productId}/adjust-stock/`, {
        method: 'POST',
        body: JSON.stringify({ change, reason: 'Stock updated via UI' })
      });

      // Refresh product list item or whole list
      await loadProducts();
    } catch (err) {
      console.error('updateStock error', err);
      throw err;
    }
  }

  /* ---------------------------
     UI event handlers that call above helpers
     --------------------------- */

  async function handleSaveProduct(payload) {
    try {
      if (selectedProduct && selectedProduct.id) {
        if (!isAdmin) { alert('Only admins can edit product details.'); return; }
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

  /* ---------------------------
     Render
     --------------------------- */

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
          <input placeholder="Search products by name, SKU, category, or vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <th>Category</th>
                <th>Stock</th>
                {isAdmin && <th>Cost</th>}
                <th>Price</th>
                <th>Min Price</th>
                <th>Vehicle</th>
                <th className="pi-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isAdmin ? 9 : 8} className="pi-empty">Loading products...</td></tr>
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
                    <td><CategoryBadge>{p.category || '—'}</CategoryBadge></td>
                    <td>
                      <div className="pi-stock-wrap">
                        <span className="pi-stock-count">{stock}</span>
                        <button title="Edit stock" className="icon-btn" onClick={() => openStockModal(p)}><Edit3 size={14} /></button>
                      </div>
                    </td>

                    {isAdmin && <td>₨ {Number(p.cost_price ?? 0).toFixed(2)}</td>}
                    {!isAdmin && <>{/* hide cost from staff */}</>}

                    <td>₨ {Number(p.selling_price ?? 0).toFixed(2)}</td>
                    <td className="pi-min-price">₨ {Number(minPrice).toFixed(2)}</td>
                    <td>{p.vehicle_for ?? p.vehicle ?? 'Universal'}</td>

                    <td className="pi-actions-col">
                      {isAdmin ? (
                        <>
                          <button className="icon-btn" title="Edit product" onClick={() => openEditProduct(p)}><Edit2 size={16} /></button>
                          <button className="icon-btn danger" title="Delete product" onClick={() => handleDelete(p)}><Trash2 size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button className="icon-btn" title="View / edit stock" onClick={() => openStockModal(p)}><Edit3 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="pi-empty">No products found.</td>
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
