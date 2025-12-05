// src/pages/attendance.jsx
import React, { useMemo, useState, useEffect } from "react";
import "../styles/attendance.css";
import api from '../api'; // your configured api client

/* ---------- Inline SVG Icon Components ---------- */
const Plus = ({ className = "icon icon-sm" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const CalendarDays = ({ className = "icon icon-md" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);
const CheckCircle2 = ({ className = "icon icon-lg muted" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>
);
const Edit = ({ className = "icon icon-sm" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const Trash2 = ({ className = "icon icon-sm danger" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);
const X = ({ className = "icon icon-md" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const DollarSign = ({ className = "icon icon-md" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

/* ---------- Small helpers ---------- */
const todayISO = (d = new Date()) => d.toISOString().split("T")[0];
const formatDateDisplay = (iso) => {
  try {
    const d = new Date(iso.replace(/-/g, '/'));
    return d.toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
};
const initials = (name = "") =>
  name.split(" ").map(n => n[0] || "").slice(0,2).join("").toUpperCase();
const formatCurrency = (amount) => `₨${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* =========================
   Main Attendance Page
   ========================= */
export default function AttendancePage() {
  // state
  const [employees, setEmployees] = useState([]);               // loaded from backend
  const [attendance, setAttendance] = useState([]);           // loaded for selected date
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isAttendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null); // for detail view
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  // derived
  const todaysRecords = attendance || []; // each item from backend (employee, date, status, daily_salary_applied...)
  const attendedEmployees = todaysRecords.map(r => {
    const emp = employees.find(e => Number(e.id) === Number(r.employee) || String(e.id) === String(r.employee));
    const payout = Number(r.daily_salary_applied || 0);
    return emp ? { ...emp, status: r.status, payout } : null;
  }).filter(Boolean);

  const presentCount = attendedEmployees.filter(e => e.status === "Present").length;
  const absentCount = attendedEmployees.filter(e => e.status === "Absent").length;
  const presentPercent = employees.length ? Math.round((presentCount / employees.length) * 100) : 0;

  // total payout based on today's records
  const totalPayoutToday = todaysRecords.reduce((acc, r) => {
    return acc + ((r.status === 'Present') ? (Number(r.daily_salary_applied || 0)) : 0);
  }, 0);

  const filteredEmployees = employees.filter(e =>
    (e.name + " " + e.department + " " + (e.employee_code || e.employeeId || '')).toLowerCase().includes(query.toLowerCase())
  );

  const activeStaffCount = employees.length;

  /* ---------- Load data ---------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadEmployees(), loadAttendance(selectedDate)]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // load once

  // reload attendance when selectedDate changes
  useEffect(() => {
    loadAttendance(selectedDate);
  }, [selectedDate]);

  async function loadEmployees() {
    try {
      const resp = await api.get('/employees/');
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? [];
      setEmployees(raw);
    } catch (err) {
      console.error('Failed to load employees', err);
      alert('Could not load employees: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  async function loadAttendance(date) {
    try {
      const resp = await api.get('/attendance/', { params: { date } });
      const raw = Array.isArray(resp.data) ? resp.data : resp.data.results ?? resp.data.data ?? resp.data;
      setAttendance(raw || []);
    } catch (err) {
      console.error('Failed to load attendance', err);
      setAttendance([]);
    }
  }

  /* ---------- Employee CRUD & Detail ---------- */
  function openAddEmployee() {
    setEditingEmployee(null);
    setEmployeeModalOpen(true);
  }
  function openEditEmployee(emp) {
    setEditingEmployee(emp);
    setEmployeeModalOpen(true);
  }
  function closeEmployeeModal() {
    setEditingEmployee(null);
    setEmployeeModalOpen(false);
  }

  function openEmployeeDetail(emp) {
    setSelectedEmployeeDetail(emp);
  }
  function closeEmployeeDetail() {
    setSelectedEmployeeDetail(null);
  }

  async function saveEmployee(data) {
    setSavingEmployee(true);
    try {
      if (editingEmployee && editingEmployee.id) {
        const resp = await api.patch(`/employees/${editingEmployee.id}/`, data);
        const updated = resp.data;
        setEmployees(prev => prev.map(e => (String(e.id) === String(updated.id) ? updated : e)));
        alert('Employee updated');
      } else {
        const resp = await api.post('/employees/', data);
        const created = resp.data;
        setEmployees(prev => [created, ...(prev || [])]);
        alert('Employee created');
      }
    } catch (err) {
      console.error('Save employee failed', err);
      alert('Failed to save employee: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setSavingEmployee(false);
      closeEmployeeModal();
    }
  }

  async function deleteEmployee(id) {
    if (!window.confirm('Delete this employee? This cannot be undone.')) return;
    try {
      await api.delete(`/employees/${id}/`);
      setEmployees(prev => prev.filter(e => String(e.id) !== String(id)));
      // also remove attendance for this employee locally
      setAttendance(prev => prev.filter(a => String(a.employee) !== String(id)));
      // if detail modal is open for the same employee, close it
      if (selectedEmployeeDetail && String(selectedEmployeeDetail.id) === String(id)) {
        closeEmployeeDetail();
      }
      alert('Employee deleted');
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  /* ---------- Attendance handling ---------- */
  function openAttendanceModal() {
    setAttendanceModalOpen(true);
  }
  function closeAttendanceModal() {
    setAttendanceModalOpen(false);
  }

  // Called by AttendanceModal: attMap is { employeeId: { status, payout } }
  async function submitAttendance(attMap) {
    // Build records array for backend bulk-mark
    const date = selectedDate;
    const records = Object.entries(attMap).map(([employeeId, data]) => {
      return {
        employee_id: Number(employeeId), // backend expected field
        status: data.status,
        daily_salary_applied: (data.status === 'Present') ? Number(data.payout || 0) : 0,
      };
    });

    setSavingAttendance(true);
    try {
      await api.post('/attendance/bulk-mark/', { date, records });
      // Response contains created/updated summary; reload attendance & employees
      await loadAttendance(date);
      alert('Attendance saved');
    } catch (err) {
      console.error('Save attendance failed', err);
      alert('Failed to save attendance: ' + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setSavingAttendance(false);
      closeAttendanceModal();
    }
  }

  return (
    <div className="am-page">
      <div className="am-container">

        {/* Header */}
        <header className="am-header" aria-labelledby="attendance-heading">
          <div>
            <h1 id="attendance-heading" className="am-title">Attendance</h1>
            <p className="am-sub">Professional, fast attendance management</p>
          </div>

          <div className="am-header-actions" role="group" aria-label="Header actions">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="date"
                className="am-date-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Select attendance date"
              />
              <button className="btn ghost" onClick={() => { setSelectedDate(todayISO()); }}>
                Today
              </button>
            </div>

            <button className="btn primary" onClick={openAttendanceModal} aria-label="Mark attendance">
              <Plus /> <span>Mark Attendance</span>
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="am-stats" aria-hidden={false}>
          <StatCard title="Active Staff" value={activeStaffCount} color="var(--am-accent)" icon={<CalendarDays />} />
          <StatCard title="Present" value={presentCount} sub={`${presentPercent}% of staff`} color="var(--am-green)" icon={<CheckCircle2 />} />
          <StatCard title="Absent" value={absentCount} color="var(--am-red)" icon={<X />} />
          <StatCard title="Total Payout" value={formatCurrency(totalPayoutToday)} sub="For present staff" color="#f59e0b" icon={<DollarSign />} />
        </section>

        {/* Main layout */}
        <section className="am-main-grid" aria-live="polite">
          <div className="am-left-card card" role="region" aria-label="Daily attendance list">
            <div className="am-card-head">
              <div className="am-card-title">
                <CalendarDays className="icon icon-md accent" />
                <div>
                  <h2 style={{ margin: 0 }}>Daily Attendance</h2>
                  <div style={{ fontSize: 13, color: "var(--am-muted)" }}>{formatDateDisplay(selectedDate)}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="search"
                  placeholder="Search staff, id or dept..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="input"
                  style={{ padding: "8px 10px" }}
                  aria-label="Search employees"
                />
              </div>
            </div>

            <div className="am-card-body">
              {attendedEmployees.length === 0 ? (
                <EmptyAttendance onMark={openAttendanceModal} />
              ) : (
                <>
                  <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ color: "var(--am-muted)", fontSize: 13 }}>{attendedEmployees.length} records</div>
                    <div style={{ color: "var(--am-muted)", fontSize: 13 }}>Present: <strong style={{ color: "var(--am-green)" }}>{presentCount}</strong></div>
                  </div>
                  <AttendanceList employees={attendedEmployees} />
                </>
              )}
            </div>
          </div>

          <aside className="am-right-card card" aria-label="Manage employees">
            <div className="am-card-head" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>Employees</h2>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn ghost" onClick={() => { setQuery(""); }}>
                  Reset
                </button>
                <button className="btn ghost" onClick={openAddEmployee} aria-label="Add employee">
                  <Plus /> <span className="btn-text">Add</span>
                </button>
              </div>
            </div>

            <div className="am-card-body">
              <EmployeeList
                employees={filteredEmployees}
                onEdit={(emp) => { openEditEmployee(emp); }}
                onDelete={(id) => deleteEmployee(id)}
                onOpenDetail={(emp) => openEmployeeDetail(emp)}
              />
            </div>
          </aside>
        </section>
      </div>

      {/* Modals */}
      {isEmployeeModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={closeEmployeeModal}
          onSave={saveEmployee}
          saving={savingEmployee}
        />
      )}

      {selectedEmployeeDetail && (
        <EmployeeDetailModal
          employee={selectedEmployeeDetail}
          onClose={closeEmployeeDetail}
          onEdit={(emp) => { closeEmployeeDetail(); openEditEmployee(emp); }}
          onDelete={(id) => deleteEmployee(id)}
        />
      )}

      {isAttendanceModalOpen && (
        <AttendanceModal
          employees={employees}
          todaysAttendance={todaysRecords}
          selectedDate={selectedDate}
          onClose={closeAttendanceModal}
          onSubmit={submitAttendance}
          saving={savingAttendance}
        />
      )}
    </div>
  );
}

/* =========================
   Reusable & Subcomponents
   ========================= */

function StatCard({ title, value, sub, color = "var(--am-accent)", icon }) {
  return (
    <div className="stat-card card" style={{ ['--card-color']: color }}>
      <div className="stat-info">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      {icon && <div className="stat-icon">{React.cloneElement(icon, { className: "icon icon-md" })}</div>}
    </div>
  );
}

function EmptyAttendance({ onMark }) {
  return (
    <div className="empty-attendance" role="status">
      <CheckCircle2 className="icon icon-xl muted" />
      <p className="empty-text">No attendance records for this date</p>
      <button className="btn primary" onClick={onMark}>
        <Plus /> <span>Mark Attendance</span>
      </button>
    </div>
  );
}

function AttendanceList({ employees }) {
  return (
    <div className="table-wrap">
      <table className="att-table" aria-label="Attendance table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Employee ID</th>
            <th className="mono">Day's Payout</th>
            <th style={{ width: 120 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="avatar">
                    {initials(emp.name)}
                  </div>
                  <div>
                    <div className="emp-name">{emp.name}</div>
                    <div className="emp-dept">{emp.department}</div>
                  </div>
                </div>
              </td>
              <td className="mono">{emp.employee_code || emp.employeeId}</td>
              <td className="mono">{formatCurrency(emp.payout)}</td>
              <td>
                <span className={`pill ${emp.status === "Present" ? "pill-present" : "pill-absent"}`}>
                  {emp.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Employee list now shows only basic info; clicking a row opens full detail */
function EmployeeList({ employees = [], onEdit, onDelete, onOpenDetail }) {
  return (
    <div className="employee-list" aria-live="polite">
      {employees.length === 0 && <div className="note">No employees found.</div>}
      {employees.map(emp => (
        <div
          key={emp.id}
          className="employee-row"
          role="listitem"
          onClick={() => onOpenDetail && onOpenDetail(emp)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail && onOpenDetail(emp); } }}
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          aria-label={`View details for ${emp.name}`}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="avatar-small">
              {initials(emp.name)}
            </div>
            <div>
              <div className="emp-name">{emp.name}</div>
              <div className="emp-meta">{emp.employee_code || emp.employeeId} · {emp.department}</div>
            </div>
          </div>

          <div className="row-actions" role="group" aria-label={`Quick actions for ${emp.name}`}>
            <button
              className="icon-btn"
              onClick={(e) => { e.stopPropagation(); onEdit && onEdit(emp); }}
              title="Edit"
              aria-label={`Edit ${emp.name}`}
            >
              <Edit />
            </button>
            <button
              className="icon-btn danger"
              onClick={(e) => { e.stopPropagation(); onDelete && onDelete(emp.id); }}
              title="Delete"
              aria-label={`Delete ${emp.name}`}
            >
              <Trash2 />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Modal & Employee modal components */

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function EmployeeModal({ employee, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: employee?.name || "",
    department: employee?.department || "",
    employee_code: employee?.employee_code || employee?.employeeId || "",
    daily_salary: employee?.daily_salary ?? employee?.dailySalary ?? 0,
    phone: employee?.phone || "",
    nic: employee?.nic || "",
    hire_date: employee?.hire_date ? String(employee.hire_date).split('T')[0] : (employee?.hire_date || ""),
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: employee?.name || "",
      department: employee?.department || "",
      employee_code: employee?.employee_code || employee?.employeeId || "",
      daily_salary: employee?.daily_salary ?? employee?.dailySalary ?? 0,
      phone: employee?.phone || "",
      nic: employee?.nic || "",
      hire_date: employee?.hire_date ? String(employee.hire_date).split('T')[0] : (employee?.hire_date || ""),
    });
    setError("");
  }, [employee]);

  function change(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.employee_code.trim()) {
      setError("Name and Employee ID / code are required.");
      return;
    }

    // Normalize payload fields to backend names:
    const payload = {
      name: form.name.trim(),
      department: form.department.trim() || null,
      employee_code: form.employee_code.trim(),
      daily_salary: Number(form.daily_salary || 0),
      phone: form.phone?.trim() || null,
      nic: form.nic?.trim() || null,
      // send hire_date as yyyy-mm-dd string; backend DateField will parse this
      hire_date: form.hire_date || null,
    };

    onSave(payload);
  }

  return (
    <Modal title={employee ? "Edit Employee" : "Add New Employee"} onClose={onClose}>
      <form onSubmit={submit} className="form-stack" aria-label="Employee form">
        <label className="field">
          <div className="label">Full name</div>
          <input name="name" value={form.name} onChange={change} className="input" autoFocus />
        </label>

        <div className="form-row">
          <label className="field">
            <div className="label">Department</div>
            <input name="department" value={form.department} onChange={change} className="input" />
          </label>
          <label className="field">
            <div className="label">Employee ID / Code</div>
            <input name="employee_code" value={form.employee_code} onChange={change} className="input" />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <div className="label">Phone</div>
            <input name="phone" value={form.phone} onChange={change} className="input" placeholder="+94..." />
          </label>
          <label className="field">
            <div className="label">NIC</div>
            <input name="nic" value={form.nic} onChange={change} className="input" placeholder="e.g. 123456789V" />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <div className="label">Hire date</div>
            <input
              name="hire_date"
              type="date"
              value={form.hire_date || ""}
              onChange={change}
              className="input"
            />
          </label>

          <label className="field">
            <div className="label">Default Daily Salary (₨)</div>
            <input
              name="daily_salary"
              type="number"
              value={form.daily_salary}
              onChange={change}
              className="input"
              placeholder="e.g. 2500"
            />
          </label>
        </div>

        {error && <div className="note" style={{ color: "var(--am-red)" }}>{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : (employee ? "Save Changes" : "Add Employee")}</button>
        </div>
      </form>
    </Modal>
  );
}

/* Employee Detail modal - shows full info, edit & delete actions */
function EmployeeDetailModal({ employee, onClose, onEdit, onDelete }) {
  if (!employee) return null;

  const hireDateDisplay = employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—';

  return (
    <Modal title={`Employee — ${employee.name}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 8, background: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20
          }}>
            {initials(employee.name)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{employee.name}</div>
            <div style={{ color: 'var(--am-muted)', marginTop: 4 }}>
              {employee.employee_code || employee.employeeId} · {employee.department || '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div className="small" style={{ color: 'var(--am-muted)' }}>Phone</div>
            <div>{employee.phone || '—'}</div>
          </div>
          <div>
            <div className="small" style={{ color: 'var(--am-muted)' }}>NIC</div>
            <div>{employee.nic || '—'}</div>
          </div>

          <div>
            <div className="small" style={{ color: 'var(--am-muted)' }}>Hire date</div>
            <div>{hireDateDisplay}</div>
          </div>
          <div>
            <div className="small" style={{ color: 'var(--am-muted)' }}>Default daily salary</div>
            <div>{formatCurrency(employee.daily_salary ?? employee.dailySalary ?? 0)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn ghost" onClick={() => onEdit && onEdit(employee)}><Edit /> Edit</button>
          <button
            className="btn danger"
            onClick={() => {
              if (!window.confirm(`Delete ${employee.name}? This cannot be undone.`)) return;
              onDelete && onDelete(employee.id);
              onClose && onClose();
            }}
          >
            <Trash2 /> Delete
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* AttendanceModal (connected to backend payload expectations) */
function AttendanceModal({ employees = [], todaysAttendance = [], selectedDate, onClose, onSubmit, saving }) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const newMap = {};
    employees.forEach(emp => {
      const rec = (todaysAttendance || []).find(r => String(r.employee) === String(emp.id) || String(r.employee) === String(emp.id));
      if (rec) {
        newMap[emp.id] = { status: rec.status, payout: Number(rec.daily_salary_applied || emp.daily_salary || emp.dailySalary || 0) };
      } else {
        newMap[emp.id] = { status: "Absent", payout: 0 };
      }
    });
    setMap(newMap);
  }, [employees, todaysAttendance, selectedDate]);

  function handleStatusChange(id, status) {
    setMap(prev => {
      const curr = prev[id] || { status: 'Absent', payout: 0 };
      const defaultPayout = employees.find(e => String(e.id) === String(id))?.daily_salary ?? employees.find(e => String(e.id) === String(id))?.dailySalary ?? 0;
      const payoutToUse = status === 'Present' ? (curr.payout || defaultPayout) : 0;
      return { ...prev, [id]: { status, payout: payoutToUse } };
    });
  }

  function handlePayoutChange(id, payout) {
    setMap(prev => {
      const curr = prev[id] || { status: 'Absent', payout: 0 };
      if (curr.status !== 'Present') return prev;
      return { ...prev, [id]: { ...curr, payout: Number(payout || 0) } };
    });
  }

  function setAll(status) {
    setMap(prev => {
      const next = {};
      employees.forEach(e => {
        next[e.id] = { status, payout: status === 'Present' ? Number(e.daily_salary ?? e.dailySalary ?? 0) : 0 };
      });
      return next;
    });
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(map);
  }

  const present = Object.values(map).filter(v => v.status === 'Present').length;

  return (
    <Modal title={`Mark Attendance — ${formatDateDisplay(selectedDate)}`} onClose={onClose}>
      <form onSubmit={submit} className="attendance-form" aria-label="Mark attendance form">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: "var(--am-muted)" }}>{employees.length} staff</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setAll("Present")}>Mark All Present</button>
            <button type="button" className="btn ghost" onClick={() => setAll("Absent")}>Clear All</button>
          </div>
        </div>

        <div className="attendance-list" role="list">
          {employees.map(emp => {
            const entry = map[emp.id] || { status: 'Absent', payout: 0 };
            return (
              <div key={emp.id} className="attendance-row" role="listitem" aria-label={`Attendance for ${emp.name}`} style={{ alignItems: 'center' }}>
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                  <div className="avatar-small">
                    {initials(emp.name)}
                  </div>
                  <div>
                    <div className="emp-name">{emp.name}</div>
                    <div className="emp-meta">{emp.employee_code || emp.employeeId}</div>
                  </div>
                </div>

                <div className="attendance-controls" role="radiogroup" aria-label={`Status for ${emp.name}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div className="payout-input-wrapper">
                    <span className="payout-currency">₨</span>
                    <input
                      type="number"
                      value={entry.payout}
                      onChange={(e) => handlePayoutChange(emp.id, e.target.value)}
                      disabled={entry.status === 'Absent'}
                      className="attendance-payout-input"
                      aria-label={`Payout for ${emp.name}`}
                      style={{ width: 100 }}
                    />
                  </div>

                  <label className="radio" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={`status-${emp.id}`}
                      checked={entry.status === "Present"}
                      onChange={() => handleStatusChange(emp.id, "Present")}
                    />
                    <span>Present</span>
                  </label>
                  <label className="radio" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={`status-${emp.id}`}
                      checked={entry.status === "Absent"}
                      onChange={() => handleStatusChange(emp.id, "Absent")}
                    />
                    <span>Absent</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div style={{ color: "var(--am-muted)" }}>Marked present: <strong style={{ color: "var(--am-green)" }}>{present}</strong></div>
          <div className="modal-actions" style={{ paddingTop: 0 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Submit Attendance'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
