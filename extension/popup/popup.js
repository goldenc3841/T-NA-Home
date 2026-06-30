document.addEventListener("DOMContentLoaded", async () => {
  const authPanel = document.getElementById("auth-panel");
  const activePanel = document.getElementById("active-panel");
  
  const platformUrlInput = document.getElementById("platform-url");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");
  
  const userNameEl = document.getElementById("user-name");
  const userRoleEl = document.getElementById("user-role");
  const activateBtn = document.getElementById("activate-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // Load saved session state
  const state = await chrome.storage.local.get(["platformUrl", "authToken", "userProfile"]);
  if (state.platformUrl) {
    platformUrlInput.value = state.platformUrl;
  }

  if (state.authToken && state.userProfile) {
    showActivePanel(state.userProfile);
  } else {
    showAuthPanel();
  }

  // Handle Login click
  loginBtn.addEventListener("click", async () => {
    const platformUrl = platformUrlInput.value.trim().replace(/\/$/, ""); // trim trailing slash
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!platformUrl || !email || !password) {
      showError("Please fill in all fields.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";
    hideError();

    try {
      const response = await fetch(`${platformUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const { token, user } = data;

      // Store in extension storage
      await chrome.storage.local.set({
        platformUrl,
        authToken: token,
        userProfile: user
      });

      showActivePanel(user);
    } catch (err) {
      showError(err.message || "Failed to connect to the platform.");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";
    }
  });

  // Handle Logout click
  logoutBtn.addEventListener("click", async () => {
    await chrome.storage.local.remove(["authToken", "userProfile"]);
    showAuthPanel();
  });

  // Handle Start Capture click
  activateBtn.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showError("No active tab found.");
        return;
      }
      
      // Send message to tab content script
      await chrome.tabs.sendMessage(tab.id, { action: "activate-overlay" });
      window.close(); // Close the popup
    } catch (err) {
      alert("Error: Please reload the web page first to load the content script.");
      window.close();
    }
  });

  function showActivePanel(user) {
    authPanel.classList.add("hidden");
    activePanel.classList.remove("hidden");
    userNameEl.textContent = user.name || user.email;
    userRoleEl.textContent = user.role.toUpperCase();
  }

  function showAuthPanel() {
    activePanel.classList.add("hidden");
    authPanel.classList.remove("hidden");
    passwordInput.value = "";
  }

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
  }

  function hideError() {
    loginError.classList.add("hidden");
  }
});
