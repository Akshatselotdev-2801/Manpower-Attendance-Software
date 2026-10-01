// Master Official Admin Profile
let currentUser = {
  name: "Suresh Mehra",
  id: "EMP-1001",
  role: "Admin",
  email: "admin@company.com",
  dept: "Operations",
  phone: "+919876543210"
};

async function handleOfficialAdminLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById("adminLoginIdentifier").value.trim();
  const password = document.getElementById("adminLoginPassword").value;
  const errorBox = document.getElementById("loginErrorMsg");
  const loginBtn = document.getElementById("adminLoginBtn");

  errorBox.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Verifying Credentials...</span>`;

  try {
    const response = await fetch('http://localhost:5000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Authentication failed. Invalid Admin credentials.");
    }

    // Set official Admin session
    currentUser = data.admin;
    document.getElementById("loginScreen").classList.add("hidden");
    enforceRolePermissions();
    alert(`Welcome back, ${currentUser.name}. Official Admin session initialized.`);

  } catch (err) {
    errorBox.innerText = err.message;
    errorBox.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = `<span>Authenticate & Access Console</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
  }
}