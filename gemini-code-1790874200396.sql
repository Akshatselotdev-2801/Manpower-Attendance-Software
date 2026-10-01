-- WorkPulse HRMS Web Database Schema

CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(20) PRIMARY KEY, -- e.g. EMP-1001
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Manager', 'Employee')),
    department VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    bio_status VARCHAR(50) DEFAULT 'WebAuthn Registered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) REFERENCES employees(id) ON DELETE CASCADE,
    punch_date DATE NOT NULL,
    punch_in TIME,
    punch_out TIME,
    verification_mode VARCHAR(50) DEFAULT 'Biometric Sensor',
    snapshot TEXT,
    status VARCHAR(30) DEFAULT 'Present'
);

CREATE TABLE IF NOT EXISTS approval_tickets (
    id VARCHAR(30) PRIMARY KEY,
    employee_id VARCHAR(20) REFERENCES employees(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- 'Leave', 'Change My Details', 'Punch Correction'
    details TEXT NOT NULL,
    manager_status VARCHAR(30) DEFAULT 'Pending' CHECK (manager_status IN ('Pending', 'Approved', 'Rejected')),
    admin_status VARCHAR(30) DEFAULT 'Pending' CHECK (admin_status IN ('Pending', 'Approved', 'Rejected')),
    final_verdict VARCHAR(30) DEFAULT 'Pending Both',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslips (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    working_days INT DEFAULT 26,
    present_days INT DEFAULT 0,
    basic NUMERIC(10, 2) NOT NULL,
    hra NUMERIC(10, 2) NOT NULL,
    allowances NUMERIC(10, 2) NOT NULL,
    gross NUMERIC(10, 2) NOT NULL,
    pf NUMERIC(10, 2) NOT NULL,
    pt NUMERIC(10, 2) NOT NULL,
    net NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Web Users
INSERT INTO employees (id, name, role, department, email, phone, password_hash) VALUES
('EMP-1001', 'Suresh Mehra', 'Admin', 'Operations', 'suresh.mehra@company.com', '+919876543210', 'admin_hash'),
('EMP-1002', 'Ananya Roy', 'Manager', 'Engineering', 'ananya.roy@company.com', '+919876543211', 'manager_hash'),
('EMP-1003', 'Vikram Seth', 'Employee', 'Logistics', 'vikram.seth@company.com', '+919876543212', 'employee_hash')
ON CONFLICT DO NOTHING;