// src/pages/expenses.jsx
import React, { useState, useMemo, useEffect } from 'react';
import '../styles/expenses.css';
import { Plus, ReceiptText, X } from 'lucide-react';
import api from '../api';

/**
 * AddExpenseModal
 * - Controlled inputs for: date, category, amount, paymentMethod, description, receiptFile
 * - validation and accessibility
 * - calls onSave(expenseObject) prop
 */
function AddExpenseModal({ isOpen, onClose, onSave, expenses = [] }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [error, setError] = useState('');

  // compute categories from existing expenses
  const categories = useMemo(() => {
    const setCats = new Set((expenses || []).map((e) => e.category).filter(Boolean));
    return Array.from(setCats).sort();
  }, [expenses]);

  useEffect(() => {
    if (isOpen) {
      // reset on open
      setDate(new Date().toISOString().slice(0, 10));
      setCategory(categories[0] || '');
      setAmount('');
      setPaymentMethod('cash');
      setDescription('');
      setReceiptFile(null);
      setIsAddingCategory(false);
      setNewCategory('');
      setError('');
      // prevent background scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, categories]);

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

    // Build payload (backend ExpenseSerializer expects: category, amount, paid_by, notes, receipt_url)
    const payload = {
      // date is read-only server-side -> server will set auto_now_add
      category: chosenCategory,
      amount: Math.round(amt * 100) / 100,
      paid_by: paymentMethod,
      notes: description.trim() || null,
      // the Expense model stores receipt_url as text; here we send filename.
      // If you later implement file uploading, replace this with the file URL returned by the upload endpoint.
      receipt_url: receiptFile ? receiptFile.name : null,
    };

    // call parent callback
    if (typeof onSave === 'function') {
      onSave(payload, receiptFile);
    }

    onClose();
  }

  return (
    <div className="ex-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ex-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ex-modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReceiptText size={18} />
            Add Expense
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="ex-modal-close"
              onClick={onClose}
              aria-label="Close add expense"
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
                <label className="ex-field-label" htmlFor="ex-date">
                  Date
                </label>
                <input
                  id="ex-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="ex-input"
                />
                <div className="small" style={{ color: '#6b7280', marginTop: 6 }}>
                  (Server will use current date/time; this field is for your reference)
                </div>
              </div>

              <div className="ex-field">
                <label className="ex-field-label">Category</label>
                {!isAddingCategory ? (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="ex-input"
                        aria-label="Choose expense category"
                      >
                        <option value="">-- Choose category --</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ex-btn ex-btn-secondary"
                        onClick={() => {
                          setIsAddingCategory(true);
                          setTimeout(() => {
                            const el = document.getElementById('ex-new-category');
                            if (el) el.focus();
                          }, 40);
                        }}
                      >
                        + New
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                        onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategory('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="ex-row">
              <div className="ex-field">
                <label className="ex-field-label" htmlFor="ex-amount">
                  Amount
                </label>
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
                <label className="ex-field-label" htmlFor="ex-payment">
                  Payment Method
                </label>
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
              <label className="ex-field-label" htmlFor="ex-desc">
                Description
              </label>
              <textarea
                id="ex-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details about this expense"
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
                Save Expense
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleOpen() {
    setIsModalOpen(true);
  }
  function handleClose() {
    setIsModalOpen(false);
  }

  /**
   * onSave handler passed to AddExpenseModal
   * payload: { category, amount, paid_by, notes, receipt_url }
   * receiptFile: optional File object (not uploaded here)
   */
  async function handleSaveExpense(payload, receiptFile) {
    try {
      // If you later implement a file upload endpoint, upload receiptFile first,
      // then replace payload.receipt_url with the returned URL.
      const resp = await api.post('/expenses/', payload);
      const created = resp.data;
      setExpenses((prev) => (Array.isArray(prev) ? [created, ...prev] : [created]));
      alert('Expense saved.');
    } catch (err) {
      console.error('Save expense failed', err);
      // Best-effort fallback: keep locally so user doesn't lose entry
      try {
        const fallback = {
          id: `ex-local-${Date.now()}`,
          category: payload.category,
          amount: payload.amount,
          paid_by: payload.paid_by,
          notes: payload.notes,
          receipt_url: payload.receipt_url,
          created_at: new Date().toISOString(),
          date: new Date().toISOString(),
        };
        setExpenses((prev) => [fallback, ...(prev || [])]);
        alert('Expense saved locally (server failed).');
      } catch (e) {
        alert('Failed to save expense: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
      }
    }
  }

  // format helper
  const fmt = (n) => `₨ ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="ex-page">
      <AddExpenseModal isOpen={isModalOpen} onClose={handleClose} onSave={handleSaveExpense} expenses={expenses} />

      <div className="ex-header">
        <div>
          <h2>Expense Management</h2>
          <p className="ex-sub">Track and categorize business expenses</p>
        </div>
        <button className="ex-btn ex-btn-primary" onClick={handleOpen} aria-label="Add expense">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="ex-stats-row" role="region" aria-label="Expense stats">
        <div className="card ex-stat-card" style={{ ['--card-color']: 'var(--ex-red)' }}>
          <div>
            <div className="stat-title">Today's Expenses</div>
            <div className="stat-value">{fmt(todayTotal)}</div>
            <div className="stat-subvalue">{`${todayExpenses.length} transactions`}</div>
          </div>
        </div>

        <div className="card ex-stat-card" style={{ ['--card-color']: 'var(--ex-blue)' }}>
          <div>
            <div className="stat-title">Total Expenses</div>
            <div className="stat-value">{fmt(totalExpenses)}</div>
            <div className="stat-subvalue">All time</div>
          </div>
        </div>

        <div className="card ex-stat-card" style={{ ['--card-color']: 'var(--ex-orange)' }}>
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
              <button className="ex-btn ex-btn-primary" onClick={handleOpen}>
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
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice().reverse().map((ex) => (
                    <tr key={ex.id || ex.created_at}>
                      <td>{ex.date ? new Date(ex.date).toLocaleDateString() : (ex.created_at ? new Date(ex.created_at).toLocaleDateString() : '—')}</td>
                      <td>{ex.category}</td>
                      <td style={{ maxWidth: 480 }}>{ex.notes || ex.description || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(ex.amount) || 0)}</td>
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
