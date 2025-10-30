// src/contexts/DataContext.jsx
import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext(undefined);

export function DataProvider({ children }) {
  // Products now include category (for Top Categories)
  const [products, setProducts] = useState([
    { id: 'p1', sku: 'SKU001', name: 'Engine Oil 5L', category: 'Engine & Oil', quantityInStock: 10, sellingPrice: 55.0, minimumSellingPrice: 50.0, costPrice: 40.0 },
    { id: 'p2', sku: 'SKU002', name: 'Brake Pads (Set)', category: 'Brakes', quantityInStock: 5, sellingPrice: 120.0, minimumSellingPrice: 110.0, costPrice: 85.0 },
    { id: 'p3', sku: 'SKU003', name: 'Air Filter', category: 'Filters', quantityInStock: 25, sellingPrice: 22.5, minimumSellingPrice: 20.0, costPrice: 15.0 },
    { id: 'p4', sku: 'SKU004', name: 'Spark Plugs (4x)', category: 'Engine & Oil', quantityInStock: 0, sellingPrice: 30.0, minimumSellingPrice: 28.0, costPrice: 20.0 },
    { id: 'p5', sku: 'SKU005', name: 'Headlamp Bulb', category: 'Lighting', quantityInStock: 18, sellingPrice: 12.0, minimumSellingPrice: 10.0, costPrice: 6.0 },
    { id: 'p6', sku: 'SKU006', name: 'Battery 12V', category: 'Batteries', quantityInStock: 7, sellingPrice: 65.0, minimumSellingPrice: 60.0, costPrice: 45.0 },
    { id: 'p7', sku: 'SKU007', name: 'Brake Fluid 1L', category: 'Brakes', quantityInStock: 14, sellingPrice: 9.0, minimumSellingPrice: 8.0, costPrice: 4.0 },
    { id: 'p8', sku: 'SKU008', name: 'Oil Filter', category: 'Filters', quantityInStock: 20, sellingPrice: 12.5, minimumSellingPrice: 10.0, costPrice: 6.0 },
  ]);

  // SALES - add a few sample sales to create category stats
  const [sales, setSales] = useState([
    {
      id: 's1',
      date: new Date(Date.now() - 86400000 * 6).toISOString(), // 6 days ago
      totalAmount: 360.0,
      customerName: 'John Doe',
      lines: [
        { productId: 'p2', productName: 'Brake Pads (Set)', quantity: 2, unitPrice: 120.0 },
        { productId: 'p8', productName: 'Oil Filter', quantity: 1, unitPrice: 12.5 },
      ],
      employeeId: 'u-admin',
    },
    {
      id: 's2',
      date: new Date(Date.now() - 86400000 * 4).toISOString(), // 4 days ago
      totalAmount: 37.5,
      customerName: 'Walk-in',
      lines: [{ productId: 'p3', productName: 'Air Filter', quantity: 1, unitPrice: 22.5 }, { productId: 'p5', productName: 'Headlamp Bulb', quantity: 1, unitPrice: 12.0 }],
      employeeId: 'u-staff',
    },
    {
      id: 's3',
      date: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
      totalAmount: 110.0,
      customerName: 'Walk-in',
      lines: [{ productId: 'p1', productName: 'Engine Oil 5L', quantity: 2, unitPrice: 55.0 }],
      employeeId: 'u-staff',
    },
    {
      id: 's4',
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      totalAmount: 27.0,
      customerName: 'Walk-in',
      lines: [{ productId: 'p7', productName: 'Brake Fluid 1L', quantity: 3, unitPrice: 9.0 }],
      employeeId: 'u-staff',
    },
    {
      id: 's5',
      date: new Date().toISOString(),
      totalAmount: 65.0,
      customerName: 'Client A',
      lines: [{ productId: 'p6', productName: 'Battery 12V', quantity: 1, unitPrice: 65.0 }],
      employeeId: 'u-admin',
    },
    // additional small sales for category variety
    {
      id: 's6',
      date: new Date().toISOString(),
      totalAmount: 25.0,
      customerName: 'Client B',
      lines: [{ productId: 'p8', productName: 'Oil Filter', quantity: 2, unitPrice: 12.5 }],
      employeeId: 'u-staff',
    },
  ]);

  const [customers, setCustomers] = useState([
    { id: 'c1', name: 'Test Customer', phone: '123-456-7890' },
  ]);

  const [suppliers, setSuppliers] = useState([
    { id: 'sup1', company: 'Auto Supplies Co.', contact: 'Raj', phone: '011-1234567', email: 'raj@autosup.com' },
  ]);

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [expenses, setExpenses] = useState([
    { id: 'ex1', date: new Date().toISOString(), category: 'Rent', amount: 300.0 },
    { id: 'ex2', date: new Date().toISOString(), category: 'Utilities', amount: 120.0 },
  ]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ currency: 'LKR', businessName: 'Modi Act' });

  // small helper functions (addSale etc) — keep from your previous context or simplified mocks
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

      // adjust product stocks if productId present
      newSale.lines.forEach((ln) => {
        if (ln.productId) {
          setProducts((prev) =>
            prev.map((p) => (p.id === ln.productId ? { ...p, quantityInStock: Math.max(0, (p.quantityInStock || 0) - ln.quantity) } : p))
          );
        }
      });

      setSales((prev) => [...prev, newSale]);
      return { success: true, data: newSale };
    } catch (err) {
      return { success: false, error: err.message || 'unknown' };
    }
  };

  const value = {
    products,
    sales,
    customers,
    suppliers,
    purchaseOrders,
    expenses,
    attendance,
    settings,
    addSale,
    // other actions stubbed for now
    addSupplier: (s) => { setSuppliers(prev => [...prev, { id: `sup${prev.length+1}`, ...s }]); return { success: true } },
    exportData: () => JSON.stringify({ products, sales, customers, suppliers, purchaseOrders, expenses }),
    importData: (json) => { try { const parsed = typeof json === 'string' ? JSON.parse(json) : json; if (parsed.products) setProducts(parsed.products); if (parsed.sales) setSales(parsed.sales); return { success: true } } catch(e) { return { success: false, error: e.message } } },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx === undefined) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
