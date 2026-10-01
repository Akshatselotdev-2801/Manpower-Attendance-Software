// Clean Seeding: Single Official Admin Account Only
db.serialize(() => {
  // Existing table creations ...

  db.get("SELECT COUNT(*) as count FROM employees WHERE role = 'Admin'", (err, row) => {
    if (row && row.count === 0) {
      // Create single official Admin
      db.run(
        `INSERT INTO employees (id, name, role, department, email, phone, bioSync, baseSalary)
         VALUES ('EMP-1001', 'Official Admin', 'Admin', 'Operations', 'admin@company.com', '+919876543210', 'WebAuthn Ready', 65000)`
      );
      console.log('Official Admin profile created (EMP-1001 / admin@company.com).');
    }
  });
});

// Official Admin Login Endpoint
app.post('/api/auth/admin-login', (req, res) => {
  const { identifier, password } = req.body;

  // Query database for official Admin account
  db.get(
    "SELECT * FROM employees WHERE (email = ? OR id = ?) AND role = 'Admin'",
    [identifier, identifier],
    (err, admin) => {
      if (err) return res.status(500).json({ error: "Database error during authentication." });
      if (!admin) {
        return res.status(401).json({ error: "Access Denied: Unrecognized Admin credentials." });
      }

      // Default initial password check (can be replaced with bcrypt comparison)
      const validMasterPassword = process.env.ADMIN_PASSWORD || "Admin@2026";

      if (password !== validMasterPassword) {
        return res.status(401).json({ error: "Invalid password for official Admin access." });
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