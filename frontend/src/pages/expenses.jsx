// src/pages/expenses.jsx
import React, { useState, useMemo, useEffect } from 'react';
import '../styles/expenses.css';
import { Plus, ReceiptText, X, Edit2, Trash2 } from 'lucide-react';
import api from '../api';

/**
 * AddExpenseModal
 * - Handles both Adding and Editing expenses based on expenseToEdit prop.
 */
function AddExpenseModal({ isOpen, onClose, onSave, expenses = [], expenseToEdit = null }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [error, setError] = useState('');

  // Compute categories from existing expenses
  const categories = useMemo(() => {
    const setCats = new Set((expenses || []).map((e) => e.category).filter(Boolean));
    return Array.from(setCats).sort();
  }, [expenses]);

  // Reset or Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        // --- EDIT MODE: Populate fields ---
        // Handle date parsing safely
        const dateStr = expenseToEdit.date 
          ? (typeof expenseToEdit.date === 'string' ? expenseToEdit.date.slice(0, 10) : new Date(expenseToEdit.date).toISOString().slice(0, 10)) 
          : new Date().toISOString().slice(0, 10);
          
        setDate(dateStr);
        setCategory(expenseToEdit.category || '');
        setAmount(expenseToEdit.amount || '');
        setPaymentMethod(expenseToEdit.paid_by || 'cash');
        setDescription(expenseToEdit.notes || '');
        setReceiptFile(null); // File inputs cannot be pre-filled securely
      } else {
        // --- ADD MODE: Reset fields ---
        setDate(new Date().toISOString().slice(0, 10));
        setCategory(categories[0] || '');
        setAmount('');
        setPaymentMethod('cash');
        setDescription('');
        setReceiptFile(null);
      }
      setIsAddingCategory(false);
      setNewCategory('');
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, expenseToEdit, categories]);

  if (!isOpen) return null;

  function handleFileChange(e) {
    const f = e.target.files && e.target.files[0];
    setReceiptFile(f || null);
  }

  function validateAndSave() {
    setError('');
    const chosenCategory = isAddingCategory ? newCategory.trim() : category;
    if (!chosenCategory) {
      setError('Please select or add a category.');
      return;
    }
    const amt = parseFloat(String(amount).replace(/,/g, ''));
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }

    const payload = {
      // Note: Backend 'date' is likely read-only (auto_now_add), 
      // but we pass it anyway in case the backend allows overrides.
      // date: date, 
      category: chosenCategory,
      amount: Math.round(amt * 100) / 100,
      paid_by: paymentMethod,
      notes: description.trim() || null,
      // Keep old receipt URL if editing and no new file selected
      receipt_url: receiptFile ? receiptFile.name : (expenseToEdit ? expenseToEdit.receipt_url : null),
    };

    if (typeof onSave === 'function') {
      onSave(payload, receiptFile);
    }
  }

  return (
    <div className="ex-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ex-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ex-modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReceiptText size={18} />
            {expenseToEdit ? 'Edit Expense' : 'Add Expense'}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="ex-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="ex-modal-body">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              validateAndSave();
            }}
            className="ex-form"
          >
            <div className="ex-row">
              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-date">Date</label>
                <input
                  id="ex-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="ex-input"
                />
                <div className="small" style={{ color: '#6b7280', marginTop: 6, fontSize: '0.75rem' }}>
                  (Date is set automatically by server)
                </div>
              </div>

              <div className="ex-field">
                <label className="ex-field-label">Category</label>
                {!isAddingCategory ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="ex-input"
                    >
                      <option value="">-- Choose --</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ex-btn ex-btn-secondary"
                      onClick={() => {
                        setIsAddingCategory(true);
                        setTimeout(() => document.getElementById('ex-new-category')?.focus(), 40);
                      }}
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="ex-new-category"
                      className="ex-input"
                      placeholder="New category name"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ex-btn ex-btn-secondary"
                      onClick={() => { setIsAddingCategory(false); setNewCategory(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="ex-row">
              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-amount">Amount</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ex-currency">₨ </span>
                  <input
                    id="ex-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="ex-input ex-input-narrow"
                    required
                  />
                </div>
              </div>

              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-payment">Payment Method</label>
                <select
                  id="ex-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="ex-input"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="ex-field">
              <label className="ex-field-label" htmlFor="ex-desc">Description</label>
              <textarea
                id="ex-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                className="ex-input ex-textarea"
              />
            </div>

            <div className="ex-row" style={{ alignItems: 'flex-end' }}>
              <div className="ex-field">
                <label className="ex-field-label">Receipt (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="ex-file-input"
                />
                {receiptFile && (
                  <div className="ex-file-preview">
                    <span>{receiptFile.name}</span>
                    <button
                      type="button"
                      className="ex-btn ex-btn-secondary"
                      onClick={() => setReceiptFile(null)}
                      style={{ marginLeft: 8 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }} />
            </div>

            {error && <div className="ex-form-error" role="alert">{error}</div>}

            <div className="ex-modal-footer">
              <button type="button" className="ex-btn ex-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ex-btn ex-btn-primary">
                {expenseToEdit ? 'Save Changes' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Expenses page (connected to backend)
 */
export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null); // Track editing state

  // totals
  const today = new Date().toDateString();
  const todayExpenses = (expenses || []).filter((ex) => {
    try {
      return new Date(ex.date).toDateString() === today;
    } catch {
      return false;
    }
  });
  const todayTotal = todayExpenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
  const totalExpenses = (expenses || []).reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    try {
      const resp = await api.get('/expenses/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setExpenses(raw);
    } catch (err) {
      console.error('Failed to load expenses', err);
      alert('Could not load expenses. ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setLoading(false);
    }
  }

  // --- Handlers ---

  function handleOpenAdd() {
    setEditingExpense(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(ex) {
    setEditingExpense(ex);
    setIsModalOpen(true);
  }

  function handleClose() {
    setIsModalOpen(false);
    setEditingExpense(null);
  }

  // DELETE Action
  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await api.delete(`/expenses/${id}/`);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete expense: " + (err?.response?.data?.detail || err.message));
    }
  }

  // SAVE Action (Create or Update)
  async function handleSaveExpense(payload, receiptFile) {
    try {
      if (editingExpense) {
        // --- EDIT EXISTING (PATCH) ---
        const resp = await api.patch(`/expenses/${editingExpense.id}/`, payload);
        const updated = resp.data;
        setExpenses((prev) => prev.map(ex => (ex.id === updated.id ? updated : ex)));
        alert('Expense updated successfully.');
      } else {
        // --- CREATE NEW (POST) ---
        const resp = await api.post('/expenses/', payload);
        const created = resp.data;
        setExpenses((prev) => (Array.isArray(prev) ? [created, ...prev] : [created]));
        alert('Expense saved successfully.');
      }
      handleClose();
    } catch (err) {
      console.error('Save expense failed', err);
      alert('Failed to save expense: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  // format helper
  const fmt = (n) => `₨ ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="ex-page">
      <AddExpenseModal 
        isOpen={isModalOpen} 
        onClose={handleClose} 
        onSave={handleSaveExpense} 
        expenses={expenses}
        expenseToEdit={editingExpense} // Pass to modal
      />

      <div className="ex-header">
        <div>
          <h2>Expense Management</h2>
          <p className="ex-sub">Track and categorize business expenses</p>
        </div>
        <button className="ex-btn ex-btn-primary" onClick={handleOpenAdd} aria-label="Add expense">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="ex-stats-row" role="region" aria-label="Expense stats">
        <div className="card ex-stat-card" style={{ '--card-color': 'var(--ex-red)' }}>
          <div>
            <div className="stat-title">Today's Expenses</div>
            <div className="stat-value">{fmt(todayTotal)}</div>
            <div className="stat-subvalue">{`${todayExpenses.length} transactions`}</div>
          </div>
        </div>

        <div className="card ex-stat-card" style={{ '--card-color': 'var(--ex-blue)' }}>
          <div>
            <div className="stat-title">Total Expenses</div>
            <div className="stat-value">{fmt(totalExpenses)}</div>
            <div className="stat-subvalue">All time</div>
          </div>
        </div>

        <div className="card ex-stat-card" style={{ '--card-color': 'var(--ex-orange)' }}>
          <div>
            <div className="stat-title">Categories</div>
            <div className="stat-value">{new Set((expenses || []).map((e) => e.category).filter(Boolean)).size}</div>
            <div className="stat-subvalue">Active categories</div>
          </div>
        </div>
      </div>

      <div className="card ex-history-card" role="region" aria-label="Expense history">
        <div className="ex-list-header">
          <ReceiptText size={18} />
          <span className="ex-list-title">Expense History</span>
        </div>

        <div className="ex-card-content">
          {loading ? (
            <div className="ex-empty">Loading…</div>
          ) : (!expenses || expenses.length === 0) ? (
            <div className="ex-empty">
              <ReceiptText size={48} className="ex-empty-icon" />
              <p>No expenses recorded yet</p>
              <button className="ex-btn ex-btn-primary" onClick={handleOpenAdd}>
                <Plus size={16} /> Record Your First Expense
              </button>
            </div>
          ) : (
            <div className="ex-list-table-wrapper">
              <table className="ex-table" aria-label="Expenses table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    {/* --- ADDED Actions Header --- */}
                    <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice().reverse().map((ex) => (
                    <tr key={ex.id || ex.created_at}>
                      <td>{ex.date ? new Date(ex.date).toLocaleDateString() : (ex.created_at ? new Date(ex.created_at).toLocaleDateString() : '—')}</td>
                      <td>{ex.category}</td>
                      <td style={{ maxWidth: 400 }}>{ex.notes || ex.description || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(ex.amount) || 0)}</td>
                      
                      {/* --- ADDED Actions Cell --- */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button 
                            onClick={() => handleOpenEdit(ex)}
                            className="icon-btn"
                            title="Edit"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(ex.id)}
                            className="icon-btn danger"
                            title="Delete"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}