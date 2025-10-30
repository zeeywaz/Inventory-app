import React, { useRef, useState } from 'react';
import '../styles/backup.css';
import { useData } from '../contexts/DataContext';
import { Download, Upload, Database } from 'lucide-react';

export default function BackupRestore() {
  const {
    products = [],
    sales = [],
    expenses = [],
    exportData,
    importData,
    settings = {}
  } = useData() || { products: [], sales: [], expenses: [], exportData: null, importData: null };

  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [lastActivity, setLastActivity] = useState(settings.lastActivity || new Date().toLocaleString());
  const [storageMethod] = useState(settings.storageMethod || 'Browser Local Storage');
  const [autoSaveEnabled] = useState(settings.autoSave ?? true);
  const [importPreviewName, setImportPreviewName] = useState(null);

  const safeExportData = () => {
    // Prefer context exportData if provided, else assemble from context arrays
    try {
      if (typeof exportData === 'function') {
        const result = exportData();
        // some contexts return object, some return string
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      }
      // fallback minimal export
      return JSON.stringify({ products, sales, expenses, settings }, null, 2);
    } catch (err) {
      console.error('Export failed:', err);
      return JSON.stringify({ products, sales, expenses, settings }, null, 2);
    }
  };

  const handleExport = () => {
    try {
      const json = safeExportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `automod-backup-${ts}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setLastActivity(new Date().toLocaleString());
      alert('Backup exported — save the JSON file somewhere safe.');
    } catch (err) {
      console.error(err);
      alert('Failed to export backup. See console for details.');
    }
  };

  const handleFileChoose = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const readFileAsText = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej(new Error('Failed to read file'));
    reader.readAsText(file, 'utf-8');
  });

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImportPreviewName(file.name);

    try {
      const text = await readFileAsText(file);
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error('Selected file is not valid JSON.');
      }

      // show a confirmation explaining merge behavior
      const proceed = window.confirm(
        `You chose "${file.name}".\n\n` +
        'Importing will merge data from this JSON into the current database (it may add new items and/or override existing ones depending on import logic).\n\n' +
        'Make sure you exported a current backup before importing if you want to preserve current data.\n\nProceed with import?'
      );

      if (!proceed) {
        setImportPreviewName(null);
        fileInputRef.current.value = ''; // reset
        return;
      }

      setImporting(true);
      // if context provides importData, use it (expected to merge)
      if (typeof importData === 'function') {
        const res = importData(parsed);
        // importData might return boolean or object with success
        if (res === true || (res && res.success)) {
          alert('Backup imported successfully.');
        } else {
          // try to provide more insight
          alert('Import finished (context returned a non-success value). Check console for details.');
          console.warn('importData returned:', res);
        }
      } else {
        // No import function — attempt a best-effort local merge (non-persistent)
        console.warn('No importData function provided in context — performing a temporary merge in-memory (not saved).');
        alert('No import function in context. JSON was parsed but not merged into the application data store.');
      }

      setLastActivity(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      alert(`Import failed: ${err.message || err}`);
    } finally {
      setImporting(false);
      setImportPreviewName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => {
    // forward to file chooser
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <div className="backup-page">
      <div className="backup-header">
        <div>
          <h1>Backup & Restore</h1>
          <p className="backup-sub">Protect your data by creating regular backups</p>
        </div>
        <div className="backup-actions">
          <button className="btn export-btn" onClick={handleExport}>
            <Download size={16}/> Export Backup
          </button>
          <button className="btn import-btn ghost" onClick={handleFileChoose}>
            <Upload size={16}/> Import
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{display: 'none'}} />
        </div>
      </div>

      <div className="backup-card">
        <div className="backup-card-head">
          <div className="backup-card-title"><Database size={18}/> Current Data Summary</div>
          <div className="backup-card-sub">Overview of your current database</div>
        </div>

        <div className="backup-summary">
          <div className="backup-stat stat-products">
            <div className="stat-label">Products</div>
            <div className="stat-value">{products.length}</div>
          </div>

          <div className="backup-stat stat-sales">
            <div className="stat-label">Sales</div>
            <div className="stat-value">{sales.length}</div>
          </div>

          <div className="backup-stat stat-expenses">
            <div className="stat-label">Expenses</div>
            <div className="stat-value">{expenses.length}</div>
          </div>
        </div>
      </div>

      <div className="backup-card export-card">
        <h3 className="section-title">Export Backup</h3>
        <p className="section-sub">Download all your data as a JSON file. Store this file safely as a backup.</p>

        <div className="export-row">
          <div className="export-info">
            <div className="export-title">Create Backup File</div>
            <div className="export-desc">This will download a complete backup of all products, sales, and expenses data.</div>
          </div>
          <div className="export-actions">
            <button className="btn export-btn" onClick={handleExport}><Download size={16} /> Export</button>
          </div>
        </div>

        <div className="backup-notes">
          <div className="notes-title">Backup Best Practices:</div>
          <ul>
            <li>Create backups daily or weekly</li>
            <li>Store backups in multiple safe locations</li>
            <li>Test restore procedure periodically</li>
            <li>Keep multiple backup versions</li>
          </ul>
        </div>
      </div>

      <div className="backup-card import-card">
        <h3 className="section-title">Import Backup</h3>
        <p className="section-sub">Restore data from a previously exported backup file.</p>

        <div className="import-row">
          <div className="import-info">
            <div className="import-title">Restore from Backup</div>
            <div className="import-desc">Select a backup JSON file to restore your data. This will merge with existing data.</div>
          </div>

          <div className="import-actions">
            <button className="btn import-choose" onClick={handleImportClick}><Upload size={16} /> Choose File</button>
            <button className="btn import-confirm ghost" onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click();
            }}>Import</button>
          </div>
        </div>

        <div className="import-warning">
          <div className="warn-title">Warning:</div>
          <div className="warn-text">
            Importing a backup will add data to your current database. Make sure to export a current backup first if you want to preserve your existing data.
          </div>
        </div>
      </div>

      <div className="backup-card system-card">
        <h3 className="section-title">System Information</h3>

        <div className="system-row">
          <div className="system-left">Storage Method:</div>
          <div className="system-right">{storageMethod}</div>
        </div>

        <div className="system-row">
          <div className="system-left">Auto-save:</div>
          <div className="system-right">{autoSaveEnabled ? <span className="status-enabled">Enabled</span> : <span className="status-disabled">Disabled</span>}</div>
        </div>

        <div className="system-row">
          <div className="system-left">Last Activity:</div>
          <div className="system-right">{lastActivity}</div>
        </div>
      </div>

      <div style={{height: 28}} /> {/* spacing */}
    </div>
  );
}
