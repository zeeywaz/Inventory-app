// src/pages/settings.jsx
import React, { useEffect, useState } from 'react';
import '../styles/settings.css';
import { useAuth } from '../contexts/AuthContext';
import { Save, RefreshCw, ShieldCheck, Key, Clock, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'app_settings_v1';

const defaultSettings = {
  hideBillThreshold: 2000,       // numeric currency (staff won't see bills above this)
  requireAdminApproval: true,    // price override approval requirement
  enableAuditLogging: true,
  staffCanEditStockOnly: true,
  showCostToStaff: false,
  autoBackupEnabled: false,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [settings, setSettings] = useState(defaultSettings);
  const [savedAt, setSavedAt] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        setSavedAt(new Date().toLocaleString());
      }
    } catch (err) {
      // ignore
    }
  }, []);

  function updateField(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    setStatus('');
  }

  function handleSave(e) {
    e.preventDefault();
    if (!isAdmin) {
      setStatus('Only admins can change global settings.');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSavedAt(new Date().toLocaleString());
      setStatus('Settings saved.');
    } catch (err) {
      setStatus('Failed to save settings.');
      console.error(err);
    }
  }

  function handleReset() {
    if (!isAdmin) {
      setStatus('Only admins can reset settings.');
      return;
    }
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
    setSavedAt(null);
    setStatus('Settings reset to defaults.');
  }

  return (
    <main className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Configure system, security and role-based visibility</p>
        </div>

        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleReset} title="Reset to defaults">
            <RefreshCw size={16} /> Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave} title="Save settings">
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <form className="settings-grid" onSubmit={(e) => e.preventDefault()}>
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
                value={settings.hideBillThreshold}
                onChange={(e) => updateField('hideBillThreshold', Number(e.target.value))}
                className="input"
                placeholder="Amount (e.g. 2000)"
                aria-label="Hide bill threshold"
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
                  checked={settings.requireAdminApproval}
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
                  checked={settings.enableAuditLogging}
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
                  checked={settings.staffCanEditStockOnly}
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
                  checked={settings.showCostToStaff}
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
                <div className="field-help">Enable daily automatic backup to local storage (demo mode).</div>
              </div>
              <div className="toggle">
                <input
                  id="autoBackupEnabled"
                  type="checkbox"
                  checked={settings.autoBackupEnabled}
                  onChange={(e) => updateField('autoBackupEnabled', e.target.checked)}
                  disabled={!isAdmin}
                />
                <label htmlFor="autoBackupEnabled" />
              </div>
            </label>

            <div className="small-note">
              <EyeOff size={14} /> <span>Remember: sensitive data should be handled securely (this demo stores settings in localStorage).</span>
            </div>
          </div>
        </section>
      </form>

      <footer className="settings-footer">
        <div className="status">
          <div className={`status-text ${status.includes('failed') ? 'error' : ''}`}>{status}</div>
          <div className="saved-at">{savedAt ? `Saved: ${savedAt}` : 'Not saved'}</div>
        </div>

        <div className="footer-actions">
          <button className="btn btn-secondary" onClick={() => { setStatus(''); setSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(defaultSettings))); }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!isAdmin}>
            Save changes
          </button>
        </div>
      </footer>
    </main>
  );
}
