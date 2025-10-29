import React, { createContext, useContext, useState } from 'react';

// This file provides MOCK data so your app doesn't crash!
// All your components will get their data from here.

const DataContext = createContext(undefined);

export function DataProvider({ children }) {
  const [products, setProducts] = useState([
    // Added more fields to match sales.jsx usage
    {
      id: 'p1',
      sku: 'SKU001',
      name: 'Engine Oil 5L',
      quantityInStock: 10,
      sellingPrice: 55.00,
      minimumSellingPrice: 50.00, // Added min price
      costPrice: 40.00
    },
     {
      id: 'p2',
      sku: 'SKU002',
      name: 'Brake Pads (Set)',
      quantityInStock: 5,
      sellingPrice: 120.00,
      minimumSellingPrice: 110.00,
      costPrice: 85.00
    },
     {
      id: 'p3',
      sku: 'SKU003',
      name: 'Air Filter',
      quantityInStock: 25,
      sellingPrice: 22.50,
      minimumSellingPrice: 20.00,
      costPrice: 15.00
    },
     {
      id: 'p4',
      sku: 'SKU004',
      name: 'Spark Plugs (4x)',
      quantityInStock: 0, // Out of stock example
      sellingPrice: 30.00,
      minimumSellingPrice: 28.00,
      costPrice: 20.00
    },
  ]);
  const [sales, setSales] = useState([
      // Example Sale Data
      {
          id: 's1',
          date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
          totalAmount: 175.00,
          customerName: 'John Doe',
          lines: [
              {productId: 'p1', productName: 'Engine Oil 5L', quantity: 1, unitPrice: 55.00},
              {productId: 'p2', productName: 'Brake Pads (Set)', quantity: 1, unitPrice: 120.00},
          ]
      },
      {
          id: 's2',
          date: new Date().toISOString(), // Today
          totalAmount: 22.50,
          customerName: null, // Walk-in
           lines: [
              {productId: 'p3', productName: 'Air Filter', quantity: 1, unitPrice: 22.50},
           ]
      }
  ]);
  const [customers, setCustomers] = useState([
    { id: 'c1', name: 'Test Customer', phone: '123-456-7890' },
    { id: 'c2', name: 'John Doe', phone: '987-654-3210' }
  ]);
  // --- Add other mock data arrays as needed ---
  const [suppliers, setSuppliers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({}); // Example settings

  // --- Mock Functions (Implement actual logic later) ---
  const addSale = (billData, billLines) => {
      console.log("Attempting to add sale:", billData, billLines);
      const newSale = {
          id: `s${sales.length + 1}`,
          date: new Date().toISOString(),
          totalAmount: billData.totalAmount,
          customerName: billData.customerName || null,
          lines: billLines.map(line => ({ // Ensure lines have basic info
              productId: line.productId,
              productName: line.productName,
              quantity: line.quantity,
              unitPrice: line.unitPrice
          })),
          // Add other fields from billData if necessary
      };
      setSales(prev => [...prev, newSale]);
      // Simulate reducing stock (Important for testing availability)
      billLines.forEach(line => {
          setProducts(prevProds => prevProds.map(p =>
              p.id === line.productId
              ? { ...p, quantityInStock: (p.quantityInStock || 0) - line.quantity }
              : p
          ));
      });
      console.log("Sale added:", newSale);
      return { success: true, data: newSale }; // Return success and the new sale data
  };

  // Add other mock functions from previous steps if needed
  const exportData = () => JSON.stringify({ products, sales, customers });
  const importData = (jsonData) => { try { /* basic import logic */ return true; } catch { return false; }};
  const getFilteredSales = (isAdmin) => sales; // Simple filter for now
  const addSupplier = (data) => setSuppliers(prev => [...prev, { ...data, id: `sup${prev.length + 1}` }]);
  const updateSupplier = (id, data) => console.log("Updating supplier", id, data);
  const deleteSupplier = (id) => console.log("Deleting supplier", id);
  const addPurchaseOrder = (data, lines) => console.log("Adding PO", data, lines);
  const receivePurchaseOrder = (id, lines, userId, userName) => console.log("Receiving PO", id, lines, userId, userName);
  const addAttendance = (data) => console.log("Adding attendance", data);
  const updateAttendance = (id, data) => console.log("Updating attendance", id, data);
  const deleteAttendance = (id) => console.log("Deleting attendance", id);

  const value = {
    products,
    sales,
    customers,
    suppliers,
    expenses,
    purchaseOrders,
    attendance,
    settings,
    addSale, // Provide the addSale function
    exportData,
    importData,
    getFilteredSales,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addPurchaseOrder,
    receivePurchaseOrder,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    // Add refreshData if needed:
    refreshData: () => console.log("Refreshing data... (Mock)"),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

