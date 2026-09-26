const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite for zero-config local testing
const db = new sqlite3.Database(path.join(__dirname, 'workpulse_web.db'), (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to WorkPulse Web Database (SQLite).');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    bioSync TEXT DEFAULT 'WebAuthn Ready'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT,
    date TEXT,
    in_time TEXT,
    out_time TEXT,
    status TEXT
  )`);

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

  db.get("SELECT COUNT(*) as count FROM employees", (err, row) => {
    if (row && row.count === 0) {
      db.run("INSERT INTO employees VALUES ('EMP-1001', 'Suresh Mehra', 'Admin', 'Operations', 'suresh.mehra@company.com', '+919876543210', 'WebAuthn Ready')");
      db.run("INSERT INTO employees VALUES ('EMP-1002', 'Ananya Roy', 'Manager', 'Engineering', 'ananya.roy@company.com', '+919876543211', 'Hardware Fingerprint')");
      db.run("INSERT INTO employees VALUES ('EMP-1003', 'Vikram Seth', 'Employee', 'Logistics', 'vikram.seth@company.com', '+919876543212', 'Optical Face Sync')");
    }
  });
});

// REST Endpoints
app.get('/api/employees', (req, res) => {
  db.all("SELECT * FROM employees ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/employees', (req, res) => {
  const { id, name, role, department, email, phone, bioSync } = req.body;
  const empId = id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

  db.run(
    "INSERT INTO employees (id, name, role, department, email, phone, bioSync) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [empId, name, role || 'Employee', department || 'General', email, phone, bioSync || 'WebAuthn Ready'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Employee added successfully', id: empId });
    }
  );
});

app.put('/api/employees/:id', (req, res) => {
  const { name, role, department, email, phone } = req.body;
  db.run(
    "UPDATE employees SET name = ?, role = ?, department = ?, email = ?, phone = ? WHERE id = ?",
    [name, role, department, email, phone, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Employee updated successfully' });
    }
  );
});

app.delete('/api/employees/:id', (req, res) => {
  db.run("DELETE FROM employees WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Employee removed successfully' });
  });
});

app.post('/api/attendance/punch', (req, res) => {
  const { emp_id, type } = req.body;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString();

  if (type === 'in') {
    db.run("INSERT INTO attendance (emp_id, date, in_time, status) VALUES (?, ?, ?, 'Present')", [emp_id, dateStr, timeStr], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Punch recorded: In', time: timeStr });
    });
  } else {
    db.run("UPDATE attendance SET out_time = ? WHERE emp_id = ? AND date = ?", [timeStr, emp_id, dateStr], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Punch recorded: Out', time: timeStr });
    });
  }
});

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

app.listen(PORT, () => {
  console.log(`Web App REST API running on http://localhost:${PORT}`);
});