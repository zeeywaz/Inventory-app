// src/pages/attendance.jsx
import React, { useMemo, useState, useEffect } from "react";
import "../styles/attendance.css";

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


/* ---------- Mock initial employees ---------- */
const INITIAL_EMPLOYEES = [
  { id: "emp1", name: "Alice Smith", department: "Engineering", employeeId: "E1001", dailySalary: 3000 },
  { id: "emp2", name: "Bob Johnson", department: "Marketing", employeeId: "E1002", dailySalary: 2500 },
  { id: "emp3", name: "Charlie Lee", department: "HR", employeeId: "E1003", dailySalary: 2200 },
];

/* ---------- Small helpers ---------- */
const todayISO = (d = new Date()) => d.toISOString().split("T")[0];
const formatDateDisplay = (iso) => {
  try {
    const d = new Date(iso.replace(/-/g, '/')); // Safer date parsing
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
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  // UPDATED attendance structure
  const [attendance, setAttendance] = useState([]); // array of { id, date, employeeId, status, payout }
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isAttendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [query, setQuery] = useState("");

  // derived
  const todaysRecords = useMemo(() => attendance.filter(r => r.date === selectedDate), [attendance, selectedDate]);

  const attendedEmployees = useMemo(() =>
    todaysRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      // Pass the recorded payout, not the default salary
      return emp ? { ...emp, status: r.status, payout: r.payout } : null;
    }).filter(Boolean),
    [todaysRecords, employees]
  );

  const presentCount = attendedEmployees.filter(e => e.status === "Present").length;
  const absentCount = attendedEmployees.filter(e => e.status === "Absent").length;
  const presentPercent = employees.length ? Math.round((presentCount / employees.length) * 100) : 0;

  // UPDATED: Calculate total payout from the day's records
  const totalPayoutToday = useMemo(() => {
    return todaysRecords.reduce((acc, record) => {
      // Only sum payout if they were marked present
      return record.status === "Present" ? acc + record.payout : acc;
    }, 0);
  }, [todaysRecords]);

  const filteredEmployees = employees.filter(e =>
    (e.name + " " + e.department + " " + e.employeeId).toLowerCase().includes(query.toLowerCase())
  );

  const activeStaffCount = employees.length;

  /* ---------- Employee CRUD ---------- */
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
  function saveEmployee(data) {
    const employeeData = {
      ...data,
      dailySalary: Number(data.dailySalary) || 0 
    };
    if (editingEmployee) {
      setEmployees(prev => prev.map(p => p.id === editingEmployee.id ? { ...p, ...employeeData } : p));
    } else {
      const id = `emp${Date.now()}`;
      setEmployees(prev => [{ id, ...employeeData }, ...prev]);
    }
    closeEmployeeModal();
  }
  function deleteEmployee(id) {
    if (!window.confirm("Delete this employee? This cannot be undone.")) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
    setAttendance(prev => prev.filter(a => a.employeeId !== id));
  }

  /* ---------- Attendance handling (UPDATED) ---------- */
  function openAttendanceModal() {
    setAttendanceModalOpen(true);
  }
  function closeAttendanceModal() {
    setAttendanceModalOpen(false);
  }
  function submitAttendance(attMap) {
    // attMap: { employeeId: { status: 'Present'|'Absent', payout: number } }
    const others = attendance.filter(r => r.date !== selectedDate);
    
    const newRecords = Object.entries(attMap).map(([employeeId, data], idx) => ({
      id: `att${Date.now()}${idx}${employeeId}`,
      date: selectedDate,
      employeeId,
      status: data.status,
      payout: data.status === 'Present' ? Number(data.payout) : 0, // Ensure payout is 0 if absent
    }));
    
    setAttendance([...others, ...newRecords]);
    closeAttendanceModal();
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
              <EmployeeList employees={filteredEmployees} onEdit={openEditEmployee} onDelete={deleteEmployee} />
            </div>
          </aside>
        </section>
      </div>

      {/* Modals */}
      {isEmployeeModalOpen && (
        <EmployeeModal employee={editingEmployee} onClose={closeEmployeeModal} onSave={saveEmployee} />
      )}

      {isAttendanceModalOpen && (
        <AttendanceModal
          employees={employees}
          todaysAttendance={todaysRecords}
          selectedDate={selectedDate}
          onClose={closeAttendanceModal}
          onSubmit={submitAttendance}
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
            <th className="mono">Day's Payout</th> {/* UPDATED Header */}
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
              <td className="mono">{emp.employeeId}</td>
              <td className="mono">{formatCurrency(emp.payout)}</td> {/* UPDATED Value */}
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

function EmployeeList({ employees, onEdit, onDelete }) {
  return (
    <div className="employee-list" aria-live="polite">
      {employees.length === 0 && <div className="note">No employees found.</div>}
      {employees.map(emp => (
        <div key={emp.id} className="employee-row" role="listitem">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
             <div className="avatar-small">
              {initials(emp.name)}
            </div>
            <div>
              <div className="emp-name">{emp.name}</div>
              <div className="emp-meta">{emp.employeeId} · {emp.department} · {formatCurrency(emp.dailySalary)}/day</div>
            </div>
          </div>

          <div className="row-actions" role="group" aria-label={`Actions for ${emp.name}`}>
            <button className="icon-btn" onClick={() => onEdit(emp)} title="Edit"><Edit /></button>
            <button className="icon-btn danger" onClick={() => onDelete(emp.id)} title="Delete"><Trash2 /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Modal base ---------- */
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

/* ---------- Employee modal ---------- */
function EmployeeModal({ employee, onClose, onSave }) {
  const [form, setForm] = useState({
    name: employee?.name || "",
    department: employee?.department || "",
    employeeId: employee?.employeeId || "",
    dailySalary: employee?.dailySalary || 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: employee?.name || "",
      department: employee?.department || "",
      employeeId: employee?.employeeId || "",
      dailySalary: employee?.dailySalary || 0,
    });
    setError("");
  }, [employee]);

  function change(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.employeeId.trim()) {
      setError("Name and Employee ID are required.");
      return;
    }
    onSave(form);
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
            <div className="label">Employee ID</div>
            <input name="employeeId" value={form.employeeId} onChange={change} className="input" />
          </label>
        </div>
        
        <label className="field">
          <div className="label">Default Daily Salary (₨)</div>
          <input 
            name="dailySalary" 
            type="number" 
            value={form.dailySalary} 
            onChange={change} 
            className="input" 
            placeholder="e.g. 2500"
          />
        </label>

        {error && <div className="note" style={{ color: "var(--am-red)" }}>{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{employee ? "Save Changes" : "Add Employee"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Attendance modal (UPDATED) ---------- */
function AttendanceModal({ employees, todaysAttendance, selectedDate, onClose, onSubmit }) {
  
  // UPDATED: State now holds an object with status and payout
  const [map, setMap] = useState({});

  useEffect(() => {
    // This function now runs when the modal opens or deps change
    const buildInitialMap = () => {
      const newMap = {};
      employees.forEach(emp => {
        const rec = todaysAttendance.find(r => r.employeeId === emp.id);
        if (rec) {
          // Found an existing record for this day
          newMap[emp.id] = { status: rec.status, payout: rec.payout };
        } else {
          // No record, use default salary and mark as Absent
          newMap[emp.id] = { status: "Absent", payout: emp.dailySalary || 0 };
        }
      });
      return newMap;
    };
    setMap(buildInitialMap());
  }, [employees, todaysAttendance, selectedDate, onClose]); // Re-build map when modal is opened

  function handleStatusChange(id, status) {
    setMap(prev => {
      const newPayout = status === 'Absent' 
        ? 0 
        : (employees.find(e => e.id === id)?.dailySalary || 0); // Reset to default on "Present"
        
      // If we are marking as present, check if there was a previous payout recorded today
      const existingRecord = todaysAttendance.find(r => r.employeeId === id);
      const payoutToUse = status === 'Present' 
        ? (existingRecord ? existingRecord.payout : newPayout) // Use recorded or default
        : 0; // 0 if absent

      return {
        ...prev,
        [id]: { 
          ...prev[id], 
          status: status,
          payout: payoutToUse
        }
      };
    });
  }
  
  function handlePayoutChange(id, payout) {
    // Only allow changing payout if status is 'Present'
    setMap(prev => {
      if (prev[id].status === 'Present') {
        return {
          ...prev,
          [id]: { ...prev[id], payout: payout }
        };
      }
      return prev; // Don't change payout if absent
    });
  }

  function setAll(status) {
    setMap(prev => {
      const next = {};
      employees.forEach(e => {
        const newPayout = status === 'Present' ? (e.dailySalary || 0) : 0;
        next[e.id] = { status: status, payout: newPayout };
      });
      return next;
    });
  }

  function submit(e) {
    e.preventDefault();
    onSubmit(map);
  }

  const present = Object.values(map).filter(v => v.status === "Present").length;

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
              <div key={emp.id} className="attendance-row" role="listitem" aria-label={`Attendance for ${emp.name}`}>
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                  <div className="avatar-small">
                    {initials(emp.name)}
                  </div>
                  <div>
                    <div className="emp-name">{emp.name}</div>
                    <div className="emp-meta">{emp.employeeId}</div>
                  </div>
                </div>

                <div className="attendance-controls" role="radiogroup" aria-label={`Status for ${emp.name}`}>
                  {/* Payout Input Field */}
                  <div className="payout-input-wrapper">
                    <span className="payout-currency">₨</span>
                    <input
                      type="number"
                      value={entry.payout}
                      onChange={(e) => handlePayoutChange(emp.id, e.target.value)}
                      disabled={entry.status === 'Absent'}
                      className="attendance-payout-input"
                      aria-label={`Payout for ${emp.name}`}
                    />
                  </div>
                  
                  {/* Radio Buttons */}
                  <label className="radio" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={`status-${emp.id}`}
                      checked={entry.status === "Present"}
                      onChange={() => handleStatusChange(emp.id, "Present")}
                      aria-checked={entry.status === "Present"}
                    />
                    <span>Present</span>
                  </label>
                  <label className="radio" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={`status-${emp.id}`}
                      checked={entry.status === "Absent"}
                      onChange={() => handleStatusChange(emp.id, "Absent")}
                      aria-checked={entry.status === "Absent"}
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
            <button type="submit" className="btn primary">Submit Attendance</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}