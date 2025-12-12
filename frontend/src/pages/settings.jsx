// src/pages/settings.jsx
import React, { useEffect, useState } from 'react';
import '../styles/settings.css';
import api from '../api'; 
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext'; // Import the new context
import { Save, RefreshCw, ShieldCheck, Key, Clock, EyeOff, Loader } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.is_superuser;

  // 1. Get settings from Global Context
  const { settings: globalSettings, refreshSettings } = useSettings();

  const [localSettings, setLocalSettings] = useState(globalSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  // Sync local state when global settings finish loading
  useEffect(() => {
    setLocalSettings(globalSettings);
  }, [globalSettings]);

  function updateField(key, value) {
    setLocalSettings((s) => ({ ...s, [key]: value }));
    setStatus('');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!isAdmin) {
      setStatus('Only admins can change global settings.');
      return;
    }
    setSaving(true);

    // 2. Map camelCase -> snake_case for Backend
    const payload = {
      hide_bill_threshold: localSettings.hideBillThreshold,
      require_admin_approval: localSettings.requireAdminApproval,
      enable_audit_logging: localSettings.enableAuditLogging,
      staff_can_edit_stock_only: localSettings.staffCanEditStockOnly,
      show_cost_to_staff: localSettings.showCostToStaff,
      auto_backup_enabled: localSettings.autoBackupEnabled,
    };

    try {
      await api.patch('/system/settings/', payload);
      await refreshSettings(); // 3. Refresh context to update the whole app immediately
      setSavedAt(new Date().toLocaleString());
      setStatus('Settings saved successfully.');
    } catch (err) {
      console.error(err);
      setStatus('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setLocalSettings(globalSettings); // Revert to what is currently in context
    setStatus('Reverted to last saved settings.');
  }

  return (
    <main className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Configure system, security and role-based visibility</p>
        </div>

        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleReset} title="Discard unsaved changes">
            <RefreshCw size={16} /> Revert
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isAdmin} title="Save settings">
            {saving ? <Loader size={16} className="spin" /> : <Save size={16} />} 
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <form className="settings-grid" onSubmit={handleSave}>
        {/* Security & Access */}
        <section className="card settings-card">
          <div className="card-head">
            <div className="head-icon" aria-hidden><ShieldCheck size={18} /></div>
            <div>
              <h3>Security & Access Control</h3>
              <p className="muted">Manage role-based access and audit settings</p>
            </div>
          </div>

          <div className="card-body">
            <label className="field">
              <div className="field-label">Hide Bill Threshold (Rs)</div>
              <input
                type="number"
                min="0"
                value={localSettings.hideBillThreshold}
                onChange={(e) => updateField('hideBillThreshold', Number(e.target.value))}
                className="input"
                placeholder="Amount (e.g. 2000)"
                disabled={!isAdmin}
              />
              <div className="field-help">Bills above this amount will be hidden from staff users.</div>
            </label>

            <label className="switch-row">
              <div>
                <div className="field-label">Require Admin Approval for Price Overrides</div>
                <div className="field-help">Staff must provide reason and an admin must approve price overrides.</div>
              </div>
              <div className="toggle">
                <input
                  id="requireAdminApproval"
                  type="checkbox"
                  checked={localSettings.requireAdminApproval}
                  onChange={(e) => updateField('requireAdminApproval', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="requireAdminApproval" />
              </div>
            </label>

            <label className="switch-row">
              <div>
                <div className="field-label">Enable Audit Logging</div>
                <div className="field-help">Track price overrides, hidden bills and important actions.</div>
              </div>
              <div className="toggle">
                <input
                  id="enableAuditLogging"
                  type="checkbox"
                  checked={localSettings.enableAuditLogging}
                  onChange={(e) => updateField('enableAuditLogging', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="enableAuditLogging" />
              </div>
            </label>
          </div>
        </section>

        {/* Staff Permissions */}
        <section className="card settings-card">
          <div className="card-head">
            <div className="head-icon"><Key size={18} /></div>
            <div>
              <h3>Staff Permissions</h3>
              <p className="muted">What staff users may see and edit</p>
            </div>
          </div>

          <div className="card-body">
            <label className="switch-row">
              <div>
                <div className="field-label">Staff can edit stock only</div>
                <div className="field-help">Prevent staff from changing prices — allow stock quantity changes only.</div>
              </div>
              <div className="toggle">
                <input
                  id="staffCanEditStockOnly"
                  type="checkbox"
                  checked={localSettings.staffCanEditStockOnly}
                  onChange={(e) => updateField('staffCanEditStockOnly', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="staffCanEditStockOnly" />
              </div>
            </label>

            <label className="switch-row">
              <div>
                <div className="field-label">Show cost price to staff</div>
                <div className="field-help">If enabled staff will see cost prices — disable for privacy.</div>
              </div>
              <div className="toggle">
                <input
                  id="showCostToStaff"
                  type="checkbox"
                  checked={localSettings.showCostToStaff}
                  onChange={(e) => updateField('showCostToStaff', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="showCostToStaff" />
              </div>
            </label>
          </div>
        </section>

        {/* Backups & System */}
        <section className="card settings-card">
          <div className="card-head">
            <div className="head-icon"><Clock size={18} /></div>
            <div>
              <h3>System & Backup</h3>
              <p className="muted">Auto-backup and system behavior</p>
            </div>
          </div>

          <div className="card-body">
            <label className="switch-row">
              <div>
                <div className="field-label">Automatic backup</div>
                <div className="field-help">Enable daily automatic backup.</div>
              </div>
              <div className="toggle">
                <input
                  id="autoBackupEnabled"
                  type="checkbox"
                  checked={localSettings.autoBackupEnabled}
                  onChange={(e) => updateField('autoBackupEnabled', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="autoBackupEnabled" />
              </div>
            </label>

            <div className="small-note">
              <EyeOff size={14} /> <span>Settings are stored securely on the server and apply to all devices.</span>
            </div>
          </div>
        </section>
      </form>

      <footer className="settings-footer">
        <div className="status">
          <div className={`status-text ${status.includes('Failed') ? 'error' : 'success'}`}>{status}</div>
          <div className="saved-at">{savedAt ? `Last saved: ${savedAt}` : ''}</div>
        </div>

        <div className="footer-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            Revert
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isAdmin}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </footer>
    </main>
  );
}