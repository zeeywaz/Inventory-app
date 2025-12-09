import React, { useRef, useState, useEffect } from 'react';
import '../styles/backup.css';
import api from '../api'; // Your axios client
import { useAuth } from '../contexts/AuthContext';
import { Download, Upload, Database, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function BackupRestore() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_superuser;

  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ products: 0, sales: 0, expenses: 0 });
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // Fetch current stats just for display
  useEffect(() => {
    async function loadStats() {
      try {
        const [p, s, e] = await Promise.all([
          api.get('/products/'),
          api.get('/sales/'),
          api.get('/expenses/')
        ]);
        // Handle pagination response or array
        const count = (res) => Array.isArray(res.data) ? res.data.length : (res.data.count || 0);
        setStats({
          products: count(p),
          sales: count(s),
          expenses: count(e)
        });
      } catch (err) {
        console.error("Failed to load stats", err);
      }
    }
    loadStats();
  }, []);

  // --- EXPORT HANDLER ---
  const handleExport = async () => {
    if (!isAdmin) return alert("Access Denied");
    
    setMessage(null);
    setLoading(true);
    try {
      // 1. Request the file from backend (responseType: blob is crucial)
      const response = await api.get('/system/backup/', { responseType: 'blob' });
      
      // 2. Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Try to get filename from header, or generate one
      const contentDisp = response.headers['content-disposition'];
      let filename = `inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
      if (contentDisp && contentDisp.includes('filename=')) {
        filename = contentDisp.split('filename=')[1].replace(/"/g, '');
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setMessage({ type: 'success', text: 'Backup downloaded successfully.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to download backup.' });
    } finally {
      setLoading(false);
    }
  };

  // --- IMPORT HANDLER ---
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    const confirmMsg = `WARNING: Restoring "${file.name}" will MERGE data into your database.\n\nExisting records with the same ID will be overwritten.\nNew records will be created.\n\nAre you sure you want to proceed?`;
    
    if (!window.confirm(confirmMsg)) return;

    setMessage(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Post to backend
      const res = await api.post('/system/backup/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMessage({ type: 'success', text: `Restore Successful: ${res.data.log || 'Data merged.'}` });
      // Reload page to reflect changes or re-fetch stats
      setTimeout(() => window.location.reload(), 2000);
      
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || "Upload failed";
      setMessage({ type: 'error', text: `Restore Failed: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="backup-page" style={{display:'flex', alignItems:'center', justifyContent:'center', height:'60vh'}}>
        <div style={{textAlign:'center', color:'#6b7280'}}>
          <ShieldAlert size={48} style={{color:'#ef4444', marginBottom: 16}}/>
          <h2>Access Restricted</h2>
          <p>Only administrators can perform backups.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backup-page">
      <div className="backup-header">
        <div>
          <h1>Backup & Restore</h1>
          <p className="backup-sub">Database management and disaster recovery</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="backup-card">
        <div className="backup-card-head">
          <div className="backup-card-title"><Database size={18}/> Live Database Status</div>
        </div>
        <div className="backup-summary">
          <div className="backup-stat stat-products">
            <div className="stat-label">Products</div>
            <div className="stat-value">{stats.products}</div>
          </div>
          <div className="backup-stat stat-sales">
            <div className="stat-label">Sales</div>
            <div className="stat-value">{stats.sales}</div>
          </div>
          <div className="backup-stat stat-expenses">
            <div className="stat-label">Expenses</div>
            <div className="stat-value">{stats.expenses}</div>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`backup-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
          <span>{message.text}</span>
        </div>
      )}

      {/* Export Section */}
      <div className="backup-card export-card">
        <h3 className="section-title">Export Database</h3>
        <p className="section-sub">
          Generate a full JSON dump of your PostgreSQL database (Products, Sales, Customers, etc.).
        </p>
        <div className="export-row">
          <div className="export-actions">
            <button className="btn export-btn" onClick={handleExport} disabled={loading}>
              <Download size={16} /> 
              {loading ? 'Processing...' : 'Download Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="backup-card import-card">
        <h3 className="section-title">Restore Database</h3>
        <p className="section-sub">
          Upload a previously exported JSON file. This process uses Django's <code>loaddata</code> to merge records.
        </p>

        <div className="import-row">
          <div className="import-actions">
            <button className="btn import-choose" onClick={() => fileInputRef.current.click()} disabled={loading}>
              <Upload size={16} /> 
              {loading ? 'Restoring...' : 'Select Backup File'}
            </button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".json" 
              onChange={handleFileChange} 
              style={{display: 'none'}} 
            />
          </div>
        </div>

        <div className="import-warning">
          <div className="warn-title"><AlertTriangle size={16}/> Warning:</div>
          <div className="warn-text">
            This action will <strong>merge</strong> data. If a record in the backup has the same ID as a record in the database, the database version will be <strong>overwritten</strong>. New IDs will be created.
          </div>
        </div>
      </div>
    </div>
  );
}