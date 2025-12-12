import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from './AuthContext'; // Import Auth

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth(); // Get the current user status

  const [settings, setSettings] = useState({
    hideBillThreshold: 2000,
    requireAdminApproval: true,
    enableAuditLogging: true,
    staffCanEditStockOnly: true,
    showCostToStaff: false,
    autoBackupEnabled: false,
  });
  
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    // --- FIX: Don't fetch if no user ---
    if (!user) {
        setLoading(false);
        return;
    }

    try {
      const res = await api.get('/system/settings/');
      const s = res.data;
      setSettings({
        hideBillThreshold: Number(s.hide_bill_threshold),
        requireAdminApproval: s.require_admin_approval,
        enableAuditLogging: s.enable_audit_logging,
        staffCanEditStockOnly: s.staff_can_edit_stock_only,
        showCostToStaff: s.show_cost_to_staff,
        autoBackupEnabled: s.auto_backup_enabled,
      });
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  };

  // Only run this effect when the 'user' object changes
  useEffect(() => {
    refreshSettings();
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);