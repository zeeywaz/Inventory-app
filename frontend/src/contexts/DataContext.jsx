import React, { createContext, useContext, useState } from 'react';

// This file provides MOCK data so your app doesn't crash!
// All your components will get their data from here.

const DataContext = createContext(undefined);

export function DataProvider({ children }) {
  const [products, setProducts] = useState([
    { id: 'p1', name: 'Engine Oil', quantityInStock: 3, costPrice: 2166.67 },
  ]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([
    { id: 'c1', name: 'Test Customer' }
  ]);
  // ... add mock data for expenses, suppliers, etc.

  const value = {
    products,
    sales,
    customers,
    // Add functions here as you build them
    // e.g., addSale: () => { ... }
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
