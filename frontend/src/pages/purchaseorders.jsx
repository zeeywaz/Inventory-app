import React, { useState } from 'react';
import '../styles/purchaseorders.css'; // We'll create this CSS file
import { useData } from '../contexts/DataContext'; // Assuming this provides purchaseOrders
import { Plus, ClipboardList } from 'lucide-react'; // Import necessary icons

// --- Main Purchase Orders Component ---
export default function PurchaseOrders() {
  // Fetch purchase orders from context (using mock empty array for now)
  const { purchaseOrders = [] } = useData() || { purchaseOrders: [] };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // State for modal

  // --- Handlers ---
  const handleOpenCreateModal = () => {
    // TODO: Implement logic to open the "Create PO" modal
    console.log('Open Create PO Modal');
    // setIsCreateModalOpen(true); // Uncomment when modal component is ready
    alert("Create PO Modal not implemented yet.");
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleSavePurchaseOrder = (poData) => {
    // TODO: Implement logic to save the new PO using context function
    console.log('Saving Purchase Order:', poData);
    handleCloseCreateModal(); // Close modal after saving
    alert("PO Saved (mock)!");
  };

  return (
    <div className="po-page">
      {/* --- Header --- */}
      <div className="po-header">
        <div>
          <h2>Purchase Orders</h2>
          <p className="po-sub">Manage supplier purchase orders and stock receiving</p>
        </div>
        <button className="po-btn po-btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={18} /> Create PO
        </button>
      </div>

      {/* --- Main List Card --- */}
      <div className="card po-list-card">
        <div className="po-list-header">
          <ClipboardList size={18} />
          <span className="po-list-title">Purchase Orders ({purchaseOrders.length})</span>
          {/* Optional: Add filters or search here later */}
        </div>

        <div className="po-card-content">
          {purchaseOrders.length === 0 ? (
            // --- Empty State ---
            <div className="po-empty">
              <ClipboardList size={48} className="po-empty-icon" />
              <p>No purchase orders found</p>
              <button className="po-btn po-btn-primary" onClick={handleOpenCreateModal}>
                <Plus size={18} /> Create First Purchase Order
              </button>
            </div>
          ) : (
            // --- Populated List (Placeholder) ---
            <div className="po-list-table-wrapper">
              {/* TODO: Implement table or list view for existing purchase orders */}
              <p style={{ padding: '1rem', color: 'var(--po-text-muted)' }}>
                Purchase orders list will appear here.
              </p>
              {/* Example structure:
              <table className="po-table">
                <thead> ... </thead>
                <tbody>
                  {purchaseOrders.map(po => (
                    <tr key={po.id}> ... </tr>
                  ))}
                </tbody>
              </table>
              */}
            </div>
          )}
        </div>
      </div>

      {/* --- Add Create PO Modal component instance here --- */}
      {/* Example:
        <CreatePOModal
            isOpen={isCreateModalOpen}
            onClose={handleCloseCreateModal}
            onSave={handleSavePurchaseOrder}
            // Pass suppliers, products etc. as needed
        />
       */}

    </div> // End po-page
  );
}