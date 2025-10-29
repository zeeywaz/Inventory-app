// src/contexts/DataContext.jsx
import React, { createContext, useContext, useState } from 'react';

/**
 * Mock DataContext used for local development and testing.
 * Replace with real API calls when ready.
 */

const DataContext = createContext(undefined);

export function DataProvider({ children }) {
  // --- PRODUCTS (used by Sales, Products, PO pages) ---
  const [products, setProducts] = useState([
    { id: 'p1', sku: 'SKU001', name: 'Engine Oil 5L', quantityInStock: 10, sellingPrice: 55.0, minimumSellingPrice: 50.0, costPrice: 40.0 },
    { id: 'p2', sku: 'SKU002', name: 'Brake Pads (Set)', quantityInStock: 5, sellingPrice: 120.0, minimumSellingPrice: 110.0, costPrice: 85.0 },
    { id: 'p3', sku: 'SKU003', name: 'Air Filter', quantityInStock: 25, sellingPrice: 22.5, minimumSellingPrice: 20.0, costPrice: 15.0 },
    { id: 'p4', sku: 'SKU004', name: 'Spark Plugs (4x)', quantityInStock: 0, sellingPrice: 30.0, minimumSellingPrice: 28.0, costPrice: 20.0 },
  ]);

  // --- SALES (some historical sales) ---
  const [sales, setSales] = useState([
    {
      id: 's1',
      date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      totalAmount: 175.0,
      customerName: 'John Doe',
      lines: [
        { productId: 'p1', productName: 'Engine Oil 5L', quantity: 1, unitPrice: 55.0 },
        { productId: 'p2', productName: 'Brake Pads (Set)', quantity: 1, unitPrice: 120.0 },
      ],
      employeeId: 'u-admin', // optional
    },
    {
      id: 's2',
      date: new Date().toISOString(), // today
      totalAmount: 22.5,
      customerName: null,
      lines: [{ productId: 'p3', productName: 'Air Filter', quantity: 1, unitPrice: 22.5 }],
      employeeId: 'u-staff',
    },
  ]);

  // --- CUSTOMERS ---
  const [customers, setCustomers] = useState([
    { id: 'c1', name: 'Test Customer', phone: '123-456-7890' },
    { id: 'c2', name: 'John Doe', phone: '987-654-3210' },
  ]);

  // --- SUPPLIERS ---
  const [suppliers, setSuppliers] = useState([
    { id: 'sup1', company: 'Auto Supplies Co.', contact: 'Raj', phone: '011-1234567', email: 'raj@autosup.com' },
    { id: 'sup2', company: 'Parts Depot', contact: 'Maya', phone: '011-9876543', email: 'maya@partsdep.com' },
  ]);

  // --- PURCHASE ORDERS (POs) ---
  const [purchaseOrders, setPurchaseOrders] = useState([
    {
      id: 'po-1',
      ref: 'PO-1001',
      supplier: 'sup1',
      supplier_name: 'Auto Supplies Co.',
      expected_date: new Date(Date.now() + 86400000 * 5).toISOString(), // in 5 days
      notes: 'Urgent restock for engine oils',
      lines: [
        { product_id: 'p1', product_name: 'Engine Oil 5L', qty: 20, unit_price: 38.0 },
        { product_id: 'p3', product_name: 'Air Filter', qty: 50, unit_price: 10.0 },
      ],
      status: 'placed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'po-2',
      ref: 'PO-1000',
      supplier: 'sup2',
      supplier_name: 'Parts Depot',
      expected_date: null,
      notes: 'Routine order',
      lines: [{ product_id: 'p2', product_name: 'Brake Pads (Set)', qty: 10, unit_price: 75.0 }],
      status: 'arrived',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    },
  ]);

  // --- OTHER SMALL ARRAYS ---
  const [expenses, setExpenses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ currency: 'LKR', businessName: 'Modi Act' });

  // -------------------------
  // --- Helper functions  ---
  // -------------------------

  // Add a sale (from billing UI). Reduces stock for product lines (if productId provided).
  const addSale = (billData = {}, billLines = []) => {
    try {
      const newSale = {
        id: `s${sales.length + 1}`,
        date: new Date().toISOString(),
        totalAmount: Number(billData.totalAmount ?? billLines.reduce((s, l) => s + (Number(l.unitPrice || 0) * Number(l.quantity || 0)), 0)),
        customerName: billData.customerName ?? null,
        lines: billLines.map((l) => ({
          productId: l.productId ?? null,
          productName: l.productName ?? l.name ?? 'Custom Item',
          quantity: Number(l.quantity || 0),
          unitPrice: Number(l.unitPrice || l.unit_price || 0),
        })),
        employeeId: billData.employeeId ?? null,
      };

      // Update product quantities
      newSale.lines.forEach((ln) => {
        if (ln.productId) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === ln.productId ? { ...p, quantityInStock: Math.max(0, (p.quantityInStock || 0) - ln.quantity) } : p
            )
          );
        }
      });

      setSales((prev) => [...prev, newSale]);
      console.log('Mock: sale added', newSale);
      return { success: true, data: newSale };
    } catch (err) {
      console.error('addSale error', err);
      return { success: false, error: err.message || 'unknown' };
    }
  };

  // Add a purchase order (creates PO with status 'placed')
  const addPurchaseOrder = (poPayload) => {
    try {
      const id = `po-${purchaseOrders.length + 1 + Math.floor(Math.random() * 1000)}`;
      const po = {
        id,
        ref: poPayload.ref || `PO-${Date.now().toString().slice(-6)}`,
        supplier: poPayload.supplier,
        supplier_name: suppliers.find((s) => s.id === poPayload.supplier)?.company || '',
        expected_date: poPayload.expected_date ?? null,
        notes: poPayload.notes ?? '',
        lines: (poPayload.lines || []).map((l) => ({
          product_id: l.product_id ?? l.productId,
          product_name: l.product_name ?? l.productName,
          qty: Number(l.qty ?? l.quantity ?? 0),
          unit_price: Number(l.unit_price ?? l.unitPrice ?? 0),
        })),
        status: poPayload.status ?? 'placed',
        created_at: poPayload.created_at ?? new Date().toISOString(),
      };
      setPurchaseOrders((prev) => [po, ...prev]);
      console.log('Mock: PO added', po);
      return { success: true, data: po };
    } catch (err) {
      console.error('addPurchaseOrder error', err);
      return { success: false, error: err.message || 'unknown' };
    }
  };

  // Update PO status (e.g., admin confirms, marks as received, etc.)
  const updatePurchaseOrderStatus = (poId, newStatus) => {
    try {
      setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? { ...p, status: newStatus } : p)));
      console.log(`Mock: PO ${poId} status updated to ${newStatus}`);
      return { success: true };
    } catch (err) {
      console.error('updatePurchaseOrderStatus error', err);
      return { success: false, error: err.message || 'unknown' };
    }
  };

  // Receive a PO: increase product stock based on PO lines, mark PO as 'received'
  const receivePurchaseOrder = (poId, receivedLines = null, receivedBy = null) => {
    try {
      const po = purchaseOrders.find((p) => p.id === poId);
      if (!po) return { success: false, error: 'PO not found' };

      const linesToProcess = receivedLines ?? po.lines;
      // adjust stock
      linesToProcess.forEach((ln) => {
        const pid = ln.product_id ?? ln.productId;
        const qty = Number(ln.qty ?? ln.quantity ?? 0);
        if (!pid || qty <= 0) return;
        setProducts((prev) =>
          prev.map((p) => (p.id === pid ? { ...p, quantityInStock: (p.quantityInStock || 0) + qty } : p))
        );
      });

      // update PO status to received
      setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? { ...p, status: 'received', received_by: receivedBy, received_at: new Date().toISOString() } : p)));
      console.log(`Mock: PO ${poId} received`, { receivedLines, receivedBy });
      return { success: true };
    } catch (err) {
      console.error('receivePurchaseOrder error', err);
      return { success: false, error: err.message || 'unknown' };
    }
  };

  // Suppliers CRUD
  const addSupplier = (supplierData) => {
    const id = `sup${suppliers.length + 1}`;
    const entry = { id, ...supplierData };
    setSuppliers((prev) => [...prev, entry]);
    console.log('Mock: supplier added', entry);
    return { success: true, data: entry };
  };
  const updateSupplier = (id, data) => {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    console.log('Mock: supplier updated', id, data);
    return { success: true };
  };
  const deleteSupplier = (id) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    console.log('Mock: supplier deleted', id);
    return { success: true };
  };

  // Other small helpers
  const exportData = () => JSON.stringify({ products, sales, customers, suppliers, purchaseOrders });
  const importData = (json) => {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (parsed.products) setProducts(parsed.products);
      if (parsed.sales) setSales(parsed.sales);
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.suppliers) setSuppliers(parsed.suppliers);
      if (parsed.purchaseOrders) setPurchaseOrders(parsed.purchaseOrders);
      return { success: true };
    } catch (err) {
      console.error('importData error', err);
      return { success: false, error: err.message || 'invalid json' };
    }
  };

  // Provide values to consumers
  const value = {
    // state arrays
    products,
    sales,
    customers,
    suppliers,
    purchaseOrders,
    expenses,
    attendance,
    settings,

    // actions
    addSale,
    addPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrder,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    exportData,
    importData,

    // convenience
    refreshData: () => console.log('Mock: refreshData called'),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return ctx;
}
