const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and allow up to 10MB JSON payloads for webcam base64 snapshots
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend directly if hosted together
app.use(express.static(path.join(__dirname)));

// SQLite database initialization
const db = new sqlite3.Database(path.join(__dirname, 'workpulse_web.db'), (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to WorkPulse SQLite Database (workpulse_web.db).');
});

db.serialize(() => {
  // 1. Employees Table
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    bioSync TEXT DEFAULT 'WebAuthn Ready',
    baseSalary REAL DEFAULT 45000
  )`);

  // 2. Attendance Logs Table with Snapshots & Verification Modes
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT,
    date TEXT,
    in_time TEXT,
    out_time TEXT,
    status TEXT,
    mode TEXT,
    snapshot TEXT
  )`);

  // 3. Approval Tickets Table
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    staffName TEXT,
    staffId TEXT,
    type TEXT,
    detail TEXT,
    managerStatus TEXT DEFAULT 'Pending',
    adminStatus TEXT DEFAULT 'Pending',
    finalStatus TEXT DEFAULT 'Pending Both'
  )`);

  // 4. Payslips Table
  db.run(`CREATE TABLE IF NOT EXISTS payslips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT,
    month TEXT,
    working_days INTEGER DEFAULT 26,
    present_days INTEGER DEFAULT 0,
    basic REAL,
    hra REAL,
    allowances REAL,
    gross REAL,
    pf REAL,
    pt REAL,
    net REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed Single Official Admin Only (No test dummy users)
  db.get("SELECT COUNT(*) as count FROM employees WHERE role = 'Admin'", (err, row) => {
    if (row && row.count === 0) {
      db.run(
        `INSERT INTO employees (id, name, role, department, email, phone, bioSync, baseSalary)
         VALUES ('EMP-1001', 'Official Admin', 'Admin', 'Operations', 'admin@company.com', '+919876543210', 'WebAuthn Ready', 65000)`
      );
      console.log('>> Master Admin Profile provisioned (EMP-1001 / admin@company.com)');
    }
  });
});

// ==========================================
// 1. Official Admin Authentication Endpoint
// ==========================================
app.post('/api/auth/admin-login', (req, res) => {
  const { identifier, password } = req.body;

  db.get(
    "SELECT * FROM employees WHERE (email = ? OR id = ?) AND role = 'Admin'",
    [identifier, identifier],
    (err, admin) => {
      if (err) return res.status(500).json({ success: false, error: "Database authentication error." });
      if (!admin) {
        return res.status(401).json({ success: false, error: "Access Denied: Unrecognized Admin credentials." });
      }

      const validMasterPassword = process.env.ADMIN_PASSWORD || "Admin@2026";
      if (password !== validMasterPassword) {
        return res.status(401).json({ success: false, error: "Invalid password for official Admin access." });
      }

      res.json({
        success: true,
        message: "Admin authenticated successfully.",
        admin: {
          id: admin.id,
          name: admin.name,
          role: admin.role,
          email: admin.email,
          dept: admin.department,
          phone: admin.phone
        }
      });
    }
  );
});

// ==========================================
// 2. Staff Management Endpoints
// ==========================================
app.get('/api/employees', (req, res) => {
  db.all("SELECT * FROM employees ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/employees', (req, res) => {
  const { id, name, role, department, email, phone, bioSync, baseSalary } = req.body;
  const empId = id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

  db.run(
    "INSERT INTO employees (id, name, role, department, email, phone, bioSync, baseSalary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [empId, name, role || 'Employee', department || 'General', email, phone, bioSync || 'WebAuthn Ready', baseSalary || 40000],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Employee added successfully', id: empId });
    }
  );
});

app.put('/api/employees/:id', (req, res) => {
  const { name, role, department, email, phone, baseSalary } = req.body;
  db.run(
    "UPDATE employees SET name = ?, role = ?, department = ?, email = ?, phone = ?, baseSalary = ? WHERE id = ?",
    [name, role, department, email, phone, baseSalary, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Employee updated successfully' });
    }
  );
});

// Isolated Employee Removal (Payslip Hub Admin Only)
app.delete('/api/employees/:id', (req, res) => {
  db.run("DELETE FROM employees WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Employee successfully removed from manpower roster' });
  });
});

// ==========================================
// 3. Biometric & Camera Punch Sync Endpoint
// ==========================================
app.post('/api/attendance/punch', (req, res) => {
  const { emp_id, type, mode, snapshot } = req.body;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (type === 'in') {
    db.run(
      "INSERT INTO attendance (emp_id, date, in_time, status, mode, snapshot) VALUES (?, ?, ?, 'Present', ?, ?)",
      [emp_id, dateStr, timeStr, mode || 'Optical Camera Scanner', snapshot || null],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Punch recorded: In', time: timeStr, status: 'Present' });
      }
    );
  } else {
    db.run(
      "UPDATE attendance SET out_time = ? WHERE emp_id = ? AND date = ?",
      [timeStr, emp_id, dateStr],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Punch recorded: Out', time: timeStr, status: 'Completed' });
      }
    );
  }
});

// ==========================================
// 4. Dual Approval Tickets Endpoints
// ==========================================
app.get('/api/tickets', (req, res) => {
  db.all("SELECT * FROM tickets ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tickets', (req, res) => {
  const { staffName, staffId, type, detail } = req.body;
  const tktId = `TKT-${Math.floor(800 + Math.random() * 200)}`;
  db.run(
    "INSERT INTO tickets (id, staffName, staffId, type, detail) VALUES (?, ?, ?, ?, ?)",
    [tktId, staffName, staffId, type, detail],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Ticket registered', id: tktId });
    }
  );
});

app.put('/api/tickets/:id/approve', (req, res) => {
  const { signerRole } = req.body;
  const ticketId = req.params.id;

  db.get("SELECT * FROM tickets WHERE id = ?", [ticketId], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    let mgr = ticket.managerStatus;
    let adm = ticket.adminStatus;

    if (signerRole === 'Manager') mgr = 'Approved';
    if (signerRole === 'Admin') adm = 'Approved';

    let finalStatus = (mgr === 'Approved' && adm === 'Approved') ? 'Approved' : 'Pending Signatures';

    db.run(
      "UPDATE tickets SET managerStatus = ?, adminStatus = ?, finalStatus = ? WHERE id = ?",
      [mgr, adm, finalStatus, ticketId],
      function(uErr) {
        if (uErr) return res.status(500).json({ error: uErr.message });
        res.json({ message: `Signed by ${signerRole}`, finalStatus });
      }
    );
  });
});

// ==========================================
// 5. Dynamic Prorated Payslip Engine
// ==========================================
app.get('/api/payslips/:emp_id', (req, res) => {
  const { emp_id } = req.params;
  db.get("SELECT * FROM payslips WHERE emp_id = ? ORDER BY id DESC LIMIT 1", [emp_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

app.post('/api/payslips/generate', (req, res) => {
  const { emp_id, month, basePackage } = req.body;
  const targetMonth = month || '2026-09';
  const monthlyBase = Number(basePackage) || 45000;
  const totalWorkingDays = 26;

  db.get("SELECT COUNT(*) as daysPresent FROM attendance WHERE emp_id = ? AND status = 'Present'", [emp_id], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });

    const presentDays = countRow && countRow.daysPresent > 0 ? Math.min(countRow.daysPresent, totalWorkingDays) : 24;
    const dailyRate = monthlyBase / totalWorkingDays;
    const earnedBasic = Math.round(dailyRate * presentDays);
    const hra = Math.round(earnedBasic * 0.40);
    const allowances = 7500;
    const gross = earnedBasic + hra + allowances;
    const pf = Math.round(earnedBasic * 0.08);
    const pt = 200;
    const net = gross - (pf + pt);

    db.run(
      `INSERT INTO payslips (emp_id, month, working_days, present_days, basic, hra, allowances, gross, pf, pt, net)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp_id, targetMonth, totalWorkingDays, presentDays, earnedBasic, hra, allowances, gross, pf, pt, net],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.json({
          message: 'Payslip generated successfully',
          payslip: { emp_id, month: targetMonth, working_days: totalWorkingDays, present_days: presentDays, basic: earnedBasic, hra, allowances, gross, pf, pt, net }
        });
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` WorkPulse REST API listening at http://localhost:${PORT}`);
  console.log(` Master Admin: admin@company.com / Admin@2026`);
  console.log(`=======================================================`);
});