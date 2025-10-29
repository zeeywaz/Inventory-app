import React, { useMemo, useState, useEffect } from 'react';
import '../styles/product.css';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  DollarSign,
  Truck,
  Tag,
  Box,
  Edit3,
} from 'lucide-react';

/**
 * Product page
 * - search by name/sku/category/vehicle
 * - stats cards
 * - admin vs staff visibility & permissions
 */

function StatCard({ title, value, colorClass }) {
  return (
    <div className={`pi-stat-card ${colorClass || ''}`}>
      <div className="pi-stat-title">{title}</div>
      <div className="pi-stat-value">{value}</div>
    </div>
  );
}

/* Simple Badge */
function CategoryBadge({ children }) {
  return <span className="pi-badge">{children}</span>;
}

/* Modal to add/edit entire product - admin only */
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
        quantity_in_stock: product.quantity_in_stock ?? product.quantityInStock ?? 0,
        cost_price: product.cost_price ?? product.costPrice ?? '',
        selling_price: product.selling_price ?? product.sellingPrice ?? '',
        min_selling_price: product.min_selling_price ?? product.minSellingPrice ?? '',
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
    // validate minimally
    if (!form.name || !form.sku) {
      alert('Product name and SKU are required.');
      return;
    }
    const payload = {
      ...form,
      quantity_in_stock: Number(form.quantity_in_stock || 0),
      cost_price: Number(form.cost_price || 0),
      selling_price: Number(form.selling_price || 0),
      min_selling_price: Number(form.min_selling_price || 0),
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

/* Stock-only modal (for staff and admin) */
function EditStockModal({ open, product, onClose, onSaveStock }) {
  const [qty, setQty] = useState(0);
  useEffect(()=> {
    if (product) setQty(product.quantity_in_stock ?? product.quantityInStock ?? 0);
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

export default function ProductsPage() {
  const { products = [], updateProduct, createProduct, deleteProduct, updateStock } = useData() || {};
  const { user, role } = useAuth() || {};
  const isAdmin = role === 'admin' || user?.role === 'admin';
  const isStaff = role === 'staff' || user?.role === 'staff';

  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState(products || []);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => setFiltered(products || []), [products]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setFiltered(products || []); return; }
    const result = (products || []).filter(p => {
      return (
        (p.name || '').toString().toLowerCase().includes(q) ||
        (p.sku || '').toString().toLowerCase().includes(q) ||
        (p.category || '').toString().toLowerCase().includes(q) ||
        (p.vehicle_for || p.vehicle || '').toString().toLowerCase().includes(q)
      );
    });
    setFiltered(result);
  }, [search, products]);

  // stats
  const stats = useMemo(() => {
    const total = (products || []).length;
    const inStock = (products || []).filter(p => (p.quantity_in_stock ?? p.quantityInStock ?? 0) > 0).length;
    const low = (products || []).filter(p => {
      const stock = (p.quantity_in_stock ?? p.quantityInStock ?? 0);
      const threshold = (p.low_stock_threshold ?? p.lowStockThreshold ?? 5);
      return stock > 0 && stock <= threshold;
    }).length;
    const out = (products || []).filter(p => (p.quantity_in_stock ?? p.quantityInStock ?? 0) === 0).length;
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

  async function handleDelete(product) {
    if (!isAdmin) return alert('Only admins can delete products.');
    if (!window.confirm(`Delete product "${product.name}" (SKU: ${product.sku})? This cannot be undone.`)) return;
    if (typeof deleteProduct === 'function') {
      try {
        await deleteProduct(product.id);
        alert('Deleted');
      } catch (err) {
        console.error(err);
        alert('Delete failed');
      }
    } else {
      console.log('Delete prepared:', product);
      alert('Delete (mock) — implement deleteProduct in DataContext.');
    }
  }

  async function handleSaveProduct(payload) {
    // payload is the full product object values
    if (selectedProduct && selectedProduct.id) {
      // update
      const id = selectedProduct.id;
      if (typeof updateProduct === 'function') {
        try {
          await updateProduct(id, payload);
          alert('Saved');
        } catch (err) {
          console.error(err); alert('Save failed');
        }
      } else {
        console.log('Update prepared:', id, payload);
        alert('Saved (mock) — implement updateProduct in DataContext.');
      }
    } else {
      // create
      if (typeof createProduct === 'function') {
        try {
          await createProduct(payload);
          alert('Product added');
        } catch (err) {
          console.error(err); alert('Create failed');
        }
      } else {
        console.log('Create prepared:', payload);
        alert('Product added (mock) — implement createProduct in DataContext.');
      }
    }
    setEditModalOpen(false);
  }

  async function handleSaveStock({ productId, quantity_in_stock }) {
    if (typeof updateStock === 'function') {
      try {
        await updateStock(productId, { quantity_in_stock });
        alert('Stock updated');
      } catch (err) {
        console.error(err); alert('Stock update failed');
      }
    } else if (typeof updateProduct === 'function') {
      // fallback call to updateProduct if updateStock isn't available
      try {
        await updateProduct(productId, { quantity_in_stock });
        alert('Stock updated (via updateProduct)');
      } catch (err) {
        console.error(err); alert('Stock update failed');
      }
    } else {
      console.log('Stock update prepared:', { productId, quantity_in_stock });
      alert('Stock changed (mock) — implement updateStock/updateProduct in DataContext.');
    }
    setStockModalOpen(false);
  }

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
          <div className="pi-table-title"><Box size={16} /> Product List ({filtered.length})</div>
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
              {filtered.map((p) => {
                const stock = p.quantity_in_stock ?? p.quantityInStock ?? 0;
                const lowThreshold = p.low_stock_threshold ?? p.lowStockThreshold ?? 5;
                const minPrice = p.min_selling_price ?? p.minSellingPrice ?? p.min_price ?? 0;
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

                    {isAdmin && <td>₨ {Number(p.cost_price ?? p.costPrice ?? 0).toFixed(2)}</td>}
                    {!isAdmin && <>{/* hide cost from staff */}</>}

                    <td>₨ {Number(p.selling_price ?? p.sellingPrice ?? 0).toFixed(2)}</td>
                    <td className="pi-min-price">₨ {Number(minPrice).toFixed(2)}</td>
                    <td>{p.vehicle_for ?? p.vehicle ?? 'Universal'}</td>

                    <td className="pi-actions-col">
                      {/* admin can edit entire product, staff only stock */}
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="pi-empty">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* modals */}
      <EditProductModal open={editModalOpen} product={selectedProduct} onClose={() => setEditModalOpen(false)} onSave={handleSaveProduct} />
      <EditStockModal open={stockModalOpen} product={selectedProduct} onClose={() => setStockModalOpen(false)} onSaveStock={handleSaveStock} />
    </div>
  );
}
