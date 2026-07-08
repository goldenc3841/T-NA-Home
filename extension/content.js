(function () {
  // Prevent double injection
  if (window.tnaOverlayInitialized) return;
  window.tnaOverlayInitialized = true;

  let platformUrl = "http://localhost:3000";
  let authToken = null;
  
  // Extension State
  let captureMode = null; // 'prompt' | 'response' | null
  let capturedPrompt = "";
  let capturedResponse = "";
  let previousOutlineTarget = null;
  let previousOutlineValue = "";

  // Data loaded from Platform
  let companies = [];
  let selectedCompanyId = null;
  let features = [];
  let selectedFeatureId = null;
  let activeSessions = [];
  let selectedSessionId = "new"; // 'new' or UUID
  let newSessionName = "";
  let activeRubricVersion = null; // Contains criteria

  // Shadow DOM container
  let container = null;
  let shadowRoot = null;

  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "activate-overlay") {
      toggleOverlay();
    }
  });

  async function loadConfig() {
    const state = await chrome.storage.local.get(["platformUrl", "authToken"]);
    if (state.platformUrl) platformUrl = state.platformUrl;
    if (state.authToken) authToken = state.authToken;
  }

  async function toggleOverlay() {
    await loadConfig();
    if (!authToken) {
      alert("Please log in via the TNA Evaluator extension popup first.");
      return;
    }

    if (container) {
      removeOverlay();
    } else {
      createOverlay();
      await fetchCompanies();
    }
  }

  function createOverlay() {
    container = document.createElement("div");
    container.id = "tna-evaluator-root";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.right = "0";
    container.style.bottom = "0";
    container.style.left = "0";
    container.style.zIndex = "999999999";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    shadowRoot = container.attachShadow({ mode: "open" });

    // CSS Styling for Shadow DOM
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --primary: #8b5cf6;
        --primary-hover: #7c3aed;
        --bg-glass: rgba(15, 23, 42, 0.85);
        --bg-card: rgba(30, 41, 59, 0.4);
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --border: rgba(255, 255, 255, 0.08);
        --success: #10b981;
        --accent: #a78bfa;
      }

      * {
        box-sizing: border-box;
      }

      .overlay-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 380px;
        max-height: calc(100vh - 40px);
        background: var(--bg-glass);
        border: 1px solid var(--border);
        border-radius: 12px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        animation: slideIn 0.3s ease-out;
        z-index: 1000;
      }

      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .header {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        background: linear-gradient(135deg, #a78bfa, #8b5cf6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 4px;
        transition: color 0.2s;
      }

      .close-btn:hover {
        color: var(--text);
      }

      .content {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .selector-section {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.05em;
      }

      select, input, textarea {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px;
        color: var(--text);
        font-size: 13px;
        width: 100%;
        transition: border-color 0.2s;
      }

      select:focus, input:focus, textarea:focus {
        outline: none;
        border-color: var(--primary);
      }

      .capture-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .capture-btn {
        background: rgba(139, 92, 246, 0.1);
        border: 1px dashed var(--primary);
        color: var(--accent);
        padding: 10px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        text-align: center;
        transition: all 0.2s;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }

      .capture-btn:hover {
        background: rgba(139, 92, 246, 0.2);
      }

      .capture-btn.active {
        background: var(--primary);
        color: white;
        border-style: solid;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }

      .captured-preview {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
        max-height: 80px;
        overflow-y: auto;
        white-space: pre-wrap;
        color: #e2e8f0;
      }

      .rubric-section {
        border-top: 1px solid var(--border);
        padding-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .criterion-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .criterion-name {
        font-weight: 600;
        font-size: 13px;
        color: var(--accent);
      }

      .criterion-desc {
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      /* Dynamic Input Styling */
      .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .slider-val {
        font-weight: 700;
        font-size: 14px;
        color: var(--primary);
        width: 16px;
        text-align: center;
      }
      
      .boolean-container {
        display: flex;
        gap: 10px;
      }
      .bool-btn {
        flex: 1;
        padding: 8px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(15, 23, 42, 0.4);
        color: var(--text-muted);
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
        text-align: center;
        transition: all 0.2s;
      }
      .bool-btn.active-pass {
        background: rgba(16, 185, 129, 0.2);
        border-color: var(--success);
        color: #6ee7b7;
      }
      .bool-btn.active-fail {
        background: rgba(239, 68, 68, 0.2);
        border-color: #ef4444;
        color: #fca5a5;
      }

      .footer {
        padding: 16px;
        border-top: 1px solid var(--border);
        display: flex;
        gap: 10px;
      }

      .btn {
        flex: 1;
        padding: 10px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        font-size: 13px;
        transition: background 0.2s;
        border: none;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }
      .btn-primary:hover {
        background: var(--primary-hover);
      }
      .btn-primary:disabled {
        background: rgba(139, 92, 246, 0.4);
        cursor: not-allowed;
        color: var(--text-muted);
      }

      .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(16, 185, 129, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 600;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        animation: slideInUp 0.3s ease-out;
        pointer-events: auto;
        z-index: 1001;
      }

      @keyframes slideInUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;

    shadowRoot.appendChild(style);

    const panel = document.createElement("div");
    panel.className = "overlay-panel";
    panel.innerHTML = `
      <div class="header">
        <h3>TNA Evaluator Overlay</h3>
        <button class="close-btn" id="tna-close">&times;</button>
      </div>
      <div class="content">
        <!-- Step 1: Company, Feature & Session Selection -->
        <div class="selector-section">
          <div class="field-group">
            <label>Client Company</label>
            <select id="tna-company-select">
              <option value="">Select Company...</option>
            </select>
          </div>

          <div class="field-group id="tna-feature-group">
            <label>Evaluated Feature</label>
            <select id="tna-feature-select" disabled>
              <option value="">Select Feature...</option>
            </select>
          </div>

          <div class="field-group" id="tna-session-group">
            <label>Evaluation Session</label>
            <select id="tna-session-select" disabled>
              <option value="new">Create New Session...</option>
            </select>
            <input type="text" id="tna-session-name" placeholder="Enter session name..." class="hidden" style="margin-top: 6px;">
          </div>
        </div>

        <!-- Step 2: Content Captures -->
        <div class="field-group">
          <label>Prompt</label>
          <button class="capture-btn" id="tna-capture-prompt-btn">
            🔍 Capture Prompt from Page
          </button>
          <textarea id="tna-prompt-text" rows="2" placeholder="Captured prompt will appear here..."></textarea>
        </div>

        <div class="field-group">
          <label>Response</label>
          <button class="capture-btn" id="tna-capture-response-btn">
            🔍 Capture Response from Page
          </button>
          <textarea id="tna-response-text" rows="3" placeholder="Captured response will appear here..."></textarea>
        </div>

        <!-- Step 3: Dynamic Rubric Form -->
        <div class="rubric-section hidden" id="tna-rubric-form-container">
          <h4 style="margin: 0; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Rubric Scoring</h4>
          <div id="tna-criteria-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-primary" id="tna-submit" disabled>Submit Evaluation</button>
      </div>
    `;

    shadowRoot.appendChild(panel);

    // Event Listeners
    shadowRoot.getElementById("tna-close").addEventListener("click", removeOverlay);
    shadowRoot.getElementById("tna-company-select").addEventListener("change", handleCompanyChange);
    shadowRoot.getElementById("tna-feature-select").addEventListener("change", handleFeatureChange);
    shadowRoot.getElementById("tna-session-select").addEventListener("change", handleSessionChange);

    shadowRoot.getElementById("tna-capture-prompt-btn").addEventListener("click", () => startCaptureMode("prompt"));
    shadowRoot.getElementById("tna-capture-response-btn").addEventListener("click", () => startCaptureMode("response"));

    shadowRoot.getElementById("tna-prompt-text").addEventListener("input", (e) => {
      capturedPrompt = e.target.value;
      validateForm();
    });
    shadowRoot.getElementById("tna-response-text").addEventListener("input", (e) => {
      capturedResponse = e.target.value;
      validateForm();
    });

    shadowRoot.getElementById("tna-submit").addEventListener("click", submitEvaluation);

    // Add general page event listeners for capture hover outlining
    document.addEventListener("mouseover", handlePageMouseOver, true);
    document.addEventListener("mouseout", handlePageMouseOut, true);
    document.addEventListener("click", handlePageClick, true);
  }

  function removeOverlay() {
    // Clean up highlights if in capture mode
    stopCaptureMode();
    document.removeEventListener("mouseover", handlePageMouseOver, true);
    document.removeEventListener("mouseout", handlePageMouseOut, true);
    document.removeEventListener("click", handlePageClick, true);

    if (container) {
      container.remove();
      container = null;
      shadowRoot = null;
    }
  }

  // ==========================================
  // API Operations
  // ==========================================

  // Helper to perform API requests to TNA Home with auth headers and error handling
  async function apiFetch(endpoint, options = {}) {
    const url = `${platformUrl}${endpoint}`;
    const headers = {
      "Authorization": `Bearer ${authToken}`,
      ...options.headers
    };
    
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (netErr) {
      const err = new Error(`Failed to connect to TNA Home. Please verify that the server is running at ${platformUrl}.`);
      err.isNetworkError = true;
      throw err;
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errMsg = errorData.error || `HTTP error ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      
      // Auto-logout if the session is expired or invalid
      if (res.status === 401 || res.status === 400) {
        const lowercaseErr = errMsg.toLowerCase();
        if (
          lowercaseErr.includes("jwt") || 
          lowercaseErr.includes("expired") || 
          lowercaseErr.includes("token") || 
          lowercaseErr.includes("unauthorized") || 
          lowercaseErr.includes("invalid") ||
          lowercaseErr.includes("signature")
        ) {
          err.isAuthError = true;
          await chrome.storage.local.remove(["authToken", "userProfile"]);
          authToken = null;
          
          removeOverlay();
          alert("Your session has expired or is invalid. Please log in again via the extension popup.");
        }
      }
      throw err;
    }

    return await res.json();
  }

  async function fetchCompanies() {
    try {
      companies = await apiFetch("/api/companies");
      
      const select = shadowRoot.getElementById("tna-company-select");
      select.innerHTML = '<option value="">Select Company...</option>' + 
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    } catch (err) {
      if (!err.isAuthError) {
        alert(err.message || "Failed to load companies from TNA Home.");
      }
    }
  }

  async function handleCompanyChange(e) {
    selectedCompanyId = e.target.value;
    selectedFeatureId = null;
    activeRubricVersion = null;
    
    const featureSelect = shadowRoot.getElementById("tna-feature-select");
    const sessionSelect = shadowRoot.getElementById("tna-session-select");
    const rubricContainer = shadowRoot.getElementById("tna-rubric-form-container");
    
    featureSelect.innerHTML = '<option value="">Select Feature...</option>';
    featureSelect.disabled = true;
    sessionSelect.innerHTML = '<option value="new">Create New Session...</option>';
    sessionSelect.disabled = true;
    rubricContainer.classList.add("hidden");
    
    if (!selectedCompanyId) {
      validateForm();
      return;
    }

    try {
      features = await apiFetch(`/api/companies/${selectedCompanyId}/features`);
      featureSelect.innerHTML = '<option value="">Select Feature...</option>' + 
        features.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
      featureSelect.disabled = false;
    } catch (err) {
      console.error("Error loading features:", err);
      if (!err.isAuthError) {
        alert(err.message || "Failed to load features from TNA Home.");
      }
    }
    validateForm();
  }

  async function handleFeatureChange(e) {
    selectedFeatureId = e.target.value;
    activeRubricVersion = null;

    const sessionSelect = shadowRoot.getElementById("tna-session-select");
    const rubricContainer = shadowRoot.getElementById("tna-rubric-form-container");
    
    sessionSelect.innerHTML = '<option value="new">Create New Session...</option>';
    sessionSelect.disabled = true;
    rubricContainer.classList.add("hidden");

    if (!selectedFeatureId) {
      validateForm();
      return;
    }

    try {
      // 1. Load active rubric version for this feature
      try {
        activeRubricVersion = await apiFetch(`/api/features/${selectedFeatureId}/active-rubric`);
        renderRubricFields();
      } catch (rubricErr) {
        if (rubricErr.status === 404) {
          activeRubricVersion = null;
          renderRubricFields();
        } else {
          throw rubricErr;
        }
      }

      // 2. Load active sessions for this feature to support multi-turn appending
      activeSessions = await apiFetch(`/api/features/${selectedFeatureId}/sessions`);
      sessionSelect.innerHTML = '<option value="new">Create New Session...</option>' +
        activeSessions.map(s => `<option value="${s.id}">${s.name} (Turns: ${s.turns_count})</option>`).join("");
      sessionSelect.disabled = false;
    } catch (err) {
      console.error("Error loading active rubric/sessions:", err);
      if (!err.isAuthError) {
        alert(err.message || "Failed to load active rubric/sessions from TNA Home.");
      }
    }
    
    handleSessionChange({ target: { value: selectedSessionId } });
    validateForm();
  }

  function handleSessionChange(e) {
    selectedSessionId = e.target.value;
    const sessionNameInput = shadowRoot.getElementById("tna-session-name");
    
    if (selectedSessionId === "new") {
      sessionNameInput.classList.remove("hidden");
      newSessionName = "";
      sessionNameInput.value = "";
    } else {
      sessionNameInput.classList.add("hidden");
    }
    validateForm();
  }

  function renderRubricFields() {
    const container = shadowRoot.getElementById("tna-criteria-list");
    const formContainer = shadowRoot.getElementById("tna-rubric-form-container");
    container.innerHTML = "";

    if (!activeRubricVersion || !activeRubricVersion.criteria || activeRubricVersion.criteria.length === 0) {
      formContainer.classList.add("hidden");
      return;
    }

    formContainer.classList.remove("hidden");

    activeRubricVersion.criteria.forEach(c => {
      const card = document.createElement("div");
      card.className = "criterion-card";
      card.dataset.id = c.id;
      card.dataset.type = c.field_type;

      let inputHtml = "";

      if (c.field_type === "rating") {
        const min = c.field_options?.min || 1;
        const max = c.field_options?.max || 5;
        inputHtml = `
          <div class="slider-container">
            <input type="range" class="criterion-value" min="${min}" max="${max}" value="${min}">
            <div class="slider-val">${min}</div>
          </div>
        `;
      } else if (c.field_type === "boolean") {
        inputHtml = `
          <div class="boolean-container">
            <button type="button" class="bool-btn bool-pass" data-val="Pass">Pass</button>
            <button type="button" class="bool-btn bool-fail" data-val="Fail">Fail</button>
          </div>
          <input type="hidden" class="criterion-value" value="">
        `;
      } else if (c.field_type === "select") {
        const options = c.field_options || [];
        inputHtml = `
          <select class="criterion-value">
            <option value="">Select Option...</option>
            ${options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
          </select>
        `;
      } else if (c.field_type === "text") {
        inputHtml = `
          <textarea class="criterion-value" rows="2" placeholder="Enter notes/text evaluation..."></textarea>
        `;
      }

      card.innerHTML = `
        <div class="criterion-name">${c.name}</div>
        <div class="criterion-desc">${c.description || ""}</div>
        <div style="margin-top: 4px;">${inputHtml}</div>
        <div class="field-group" style="margin-top: 8px;">
          <label style="font-size: 9px;">Criterion Notes (Optional)</label>
          <input type="text" class="criterion-notes" placeholder="Why this score?">
        </div>
      `;

      container.appendChild(card);

      // Event Listeners for inline values
      if (c.field_type === "rating") {
        const range = card.querySelector('input[type="range"]');
        const display = card.querySelector(".slider-val");
        range.addEventListener("input", (e) => {
          display.textContent = e.target.value;
          validateForm();
        });
      } else if (c.field_type === "boolean") {
        const passBtn = card.querySelector(".bool-pass");
        const failBtn = card.querySelector(".bool-fail");
        const hiddenVal = card.querySelector(".criterion-value");
        
        passBtn.addEventListener("click", () => {
          passBtn.classList.add("active-pass");
          failBtn.classList.remove("active-fail");
          hiddenVal.value = "Pass";
          validateForm();
        });
        failBtn.addEventListener("click", () => {
          failBtn.classList.add("active-fail");
          passBtn.classList.remove("active-pass");
          hiddenVal.value = "Fail";
          validateForm();
        });
      } else {
        card.querySelector(".criterion-value").addEventListener("input", validateForm);
        card.querySelector(".criterion-value").addEventListener("change", validateForm);
      }
    });

    validateForm();
  }

  // ==========================================
  // Capture Mode Outline & Selection
  // ==========================================

  function startCaptureMode(mode) {
    captureMode = mode;
    
    // Deactivate previous buttons
    shadowRoot.getElementById("tna-capture-prompt-btn").classList.remove("active");
    shadowRoot.getElementById("tna-capture-response-btn").classList.remove("active");

    // Activate selected button
    if (mode === "prompt") {
      shadowRoot.getElementById("tna-capture-prompt-btn").classList.add("active");
    } else if (mode === "response") {
      shadowRoot.getElementById("tna-capture-response-btn").classList.add("active");
    }

    // Shrink panel slightly to help visual target selection
    shadowRoot.querySelector(".overlay-panel").style.opacity = "0.45";
  }

  function stopCaptureMode() {
    captureMode = null;
    shadowRoot.getElementById("tna-capture-prompt-btn").classList.remove("active");
    shadowRoot.getElementById("tna-capture-response-btn").classList.remove("active");
    shadowRoot.querySelector(".overlay-panel").style.opacity = "1";
    clearOutline();
  }

  function handlePageMouseOver(e) {
    if (!captureMode) return;
    
    // Ignore hover on extension overlay itself
    if (container.contains(e.target)) return;

    clearOutline();
    previousOutlineTarget = e.target;
    previousOutlineValue = e.target.style.outline;
    
    // Green outline for response, Purple outline for prompt
    e.target.style.outline = captureMode === "prompt" ? "3px dashed #8b5cf6" : "3px dashed #10b981";
    e.target.style.cursor = "pointer";
  }

  function handlePageMouseOut(e) {
    if (!captureMode) return;
    if (e.target === previousOutlineTarget) {
      clearOutline();
    }
  }

  function clearOutline() {
    if (previousOutlineTarget) {
      previousOutlineTarget.style.outline = previousOutlineValue;
      previousOutlineTarget.style.cursor = "";
      previousOutlineTarget = null;
    }
  }

  function handlePageClick(e) {
    if (!captureMode) return;
    if (container.contains(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const clickedText = e.target.innerText || e.target.value || "";
    
    if (captureMode === "prompt") {
      capturedPrompt = clickedText.trim();
      shadowRoot.getElementById("tna-prompt-text").value = capturedPrompt;
    } else if (captureMode === "response") {
      capturedResponse = clickedText.trim();
      shadowRoot.getElementById("tna-response-text").value = capturedResponse;
    }

    stopCaptureMode();
    validateForm();
  }

  // ==========================================
  // Form Validation & Submission
  // ==========================================

  function validateForm() {
    const submitBtn = shadowRoot.getElementById("tna-submit");
    
    const isCompanySelected = !!selectedCompanyId;
    const isFeatureSelected = !!selectedFeatureId;
    const isPromptCaptured = capturedPrompt.length > 0;
    const isResponseCaptured = capturedResponse.length > 0;
    
    let isSessionValid = false;
    if (selectedSessionId === "new") {
      const sessionNameInput = shadowRoot.getElementById("tna-session-name");
      newSessionName = sessionNameInput.value.trim();
      isSessionValid = newSessionName.length > 0;
    } else {
      isSessionValid = !!selectedSessionId;
    }

    // Check if all active criteria have been filled
    let areCriteriaFilled = true;
    if (activeRubricVersion && activeRubricVersion.criteria) {
      const criteriaCards = shadowRoot.querySelectorAll(".criterion-card");
      criteriaCards.forEach(card => {
        const val = card.querySelector(".criterion-value").value.trim();
        if (!val) {
          areCriteriaFilled = false;
        }
      });
    } else {
      areCriteriaFilled = false;
    }

    submitBtn.disabled = !(
      isCompanySelected &&
      isFeatureSelected &&
      isPromptCaptured &&
      isResponseCaptured &&
      isSessionValid &&
      areCriteriaFilled
    );
  }

  async function submitEvaluation() {
    const submitBtn = shadowRoot.getElementById("tna-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    // Package scores JSON
    const scores = [];
    const criteriaCards = shadowRoot.querySelectorAll(".criterion-card");
    criteriaCards.forEach(card => {
      scores.push({
        criterion_id: card.dataset.id,
        value: card.querySelector(".criterion-value").value,
        notes: card.querySelector(".criterion-notes").value.trim()
      });
    });

    const payload = {
      session_id: selectedSessionId === "new" ? null : selectedSessionId,
      feature_id: selectedFeatureId,
      rubric_version_id: activeRubricVersion.id,
      session_name: selectedSessionId === "new" ? newSessionName : null,
      prompt: capturedPrompt,
      response: capturedResponse,
      source_url: window.location.href,
      turn_number: null, // PostgreSQL function handles ordering automatically
      scores: scores
    };

    try {
      const result = await apiFetch('/api/evaluations', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      showToast("Evaluation Saved Successfully!");
      
      // Reset prompt and response fields for next evaluation
      capturedPrompt = "";
      capturedResponse = "";
      shadowRoot.getElementById("tna-prompt-text").value = "";
      shadowRoot.getElementById("tna-response-text").value = "";
      
      // Refresh features to load the updated session list (with the newly created session if applicable)
      await handleFeatureChange({ target: { value: selectedFeatureId } });
      
      // If we just created a new session, auto-select it in the dropdown so they can log multi-turn turns easily!
      if (selectedSessionId === "new" && result.session_id) {
        selectedSessionId = result.session_id;
        setTimeout(() => {
          const sessionSelect = shadowRoot.getElementById("tna-session-select");
          if (sessionSelect) {
            sessionSelect.value = result.session_id;
            handleSessionChange({ target: { value: result.session_id } });
          }
        }, 100);
      }
    } catch (err) {
      if (!err.isAuthError) {
        alert("Submission failed: " + err.message);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Evaluation";
      validateForm();
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    shadowRoot.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transition = "opacity 0.5s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 2500);
  }
})();
