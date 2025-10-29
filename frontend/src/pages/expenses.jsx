import React, { useState, useMemo } from 'react';
import '../styles/expenses.css'; // We'll create this CSS file
import { useData } from '../contexts/DataContext';
// Import icons as needed, e.g., Plus for button, Receipt for list/empty state
import { Plus, ReceiptText } from 'lucide-react';

// --- Reusable Stat Card Component (Adapt if needed) ---
// Assuming a similar StatCard component is available or defined globally
function StatCard({ title, value, subValue, color }) {
  // Using border-left style defined in expenses.css
  return (
    <div className="card stat-card ex-stat-card" style={{ '--card-color': color }}>
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-subvalue">{subValue}</span>
      </div>
    </div>
  );
}

// --- Add Expense Modal Placeholder ---
// Replace this with your actual modal component when ready
function AddExpenseModal({ isOpen, onClose, onSave }) {
    if (!isOpen) return null;
    return (
        <div className="ex-modal-overlay" onClick={onClose}>
            <div className="ex-modal-content" onClick={(e)=>e.stopPropagation()}>
                <div className="ex-modal-header">
                    <h3>Add New Expense</h3>
                    <button type="button" className="ex-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ex-modal-body">
                    <p>Expense form fields will go here...</p>
                    {/* Example fields: Date, Category, Amount, Description */}
                </div>
                <div className="ex-modal-footer">
                     <button type="button" className="ex-btn ex-btn-secondary" onClick={onClose}>Cancel</button>
                     <button type="button" className="ex-btn ex-btn-primary" onClick={() => { onSave({}); /* Pass form data */ }}>Save Expense</button>
                </div>
            </div>
        </div>
    );
}


// --- Main Expenses Component ---
export default function Expenses() {
  // Use context, provide default empty array
  const { expenses = [] } = useData() || { expenses: [] };

  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal

  // --- Handlers ---
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleSaveExpense = (expenseData) => {
    // TODO: Implement logic to save the new expense using context function (e.g., addExpense)
    console.log('Saving Expense:', expenseData);
    // Example: addExpense(expenseData);
    closeModal(); // Close modal after saving
    alert("Expense Saved (mock)!");
  };

  // --- Calculations ---
  const today = new Date().toDateString();
  const todayExpenses = expenses.filter((ex) => new Date(ex.date).toDateString() === today);
  const todayTotal = todayExpenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);

  // Calculate unique categories
  const categories = useMemo(() => {
      const categorySet = new Set(expenses.map(ex => ex.category).filter(Boolean)); // Filter out empty/null categories
      return Array.from(categorySet);
  }, [expenses]);
  const activeCategoriesCount = categories.length;


  return (
    <div className="ex-page">
      {/* --- Add Expense Modal --- */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveExpense}
        // Pass categories if needed for a dropdown
      />

      {/* --- Header --- */}
      <div className="ex-header">
        <div>
          <h2>Expense Management</h2>
          <p className="ex-sub">Track and categorize business expenses</p>
        </div>
        <button className="ex-btn ex-btn-primary" onClick={openModal}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* --- Stat Cards --- */}
      <div className="ex-stats-row">
        <StatCard
          title="Today's Expenses"
          // Use red color for expenses
          value={`$${todayTotal.toFixed(2)}`}
          subValue={`${todayExpenses.length} transactions`}
          color="var(--ex-red)" // Use red color variable
        />
        <StatCard
          title="Total Expenses"
          value={`$${totalExpenses.toFixed(2)}`}
          subValue="all time"
          color="var(--ex-text-secondary)" // Use a neutral color
        />
        <StatCard
          title="Categories"
          value={activeCategoriesCount}
          subValue="active categories"
          color="var(--ex-orange)" // Use orange color variable
        />
      </div>

      {/* --- Expense History Card --- */}
      <div className="card ex-history-card">
        <div className="ex-list-header">
          <ReceiptText size={18} /> {/* Changed Icon */}
          <span className="ex-list-title">Expense History</span>
          {/* Optional: Add filters or search here later */}
        </div>

        <div className="ex-card-content">
          {expenses.length === 0 ? (
            // --- Empty State ---
            <div className="ex-empty">
              <ReceiptText size={48} className="ex-empty-icon" /> {/* Changed Icon */}
              <p>No expenses recorded yet</p>
              <button className="ex-btn ex-btn-primary" onClick={openModal}>
                <Plus size={18} /> Record Your First Expense
              </button>
            </div>
          ) : (
            // --- Populated List (Placeholder) ---
            <div className="ex-list-table-wrapper">
              {/* TODO: Implement table or list view for existing expenses */}
              <p style={{ padding: '1rem', color: 'var(--ex-text-muted)' }}>
                Expense records would appear here. (Table needed)
              </p>
              {/* Example:
              <table className="ex-table">
                 <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Actions</th></tr></thead>
                 <tbody>
                    {expenses.map(ex => <tr key={ex.id}>...</tr>)}
                 </tbody>
              </table>
              */}
            </div>
          )}
        </div>
      </div>

    </div> // End ex-page
  );
}