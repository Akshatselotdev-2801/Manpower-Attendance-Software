-- Seed Single Official Admin (Clean Database)
INSERT INTO employees (id, name, role, department, email, phone, password_hash) VALUES
('EMP-1001', 'Official Admin', 'Admin', 'Operations', 'admin@company.com', '+919876543210', '$2b$10$MasterAdminSecureHashPlaceholder')
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = 'Admin';