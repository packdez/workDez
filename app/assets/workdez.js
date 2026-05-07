/* ============================================================
   workdez.js — Shared utilities
   Used by both contractor and client shells
   Defines the WD namespace used by all pages
   ============================================================ */

const WD = (function () {

  // ── Will be set by each shell ───────────────────────────────
  let _apiUrl  = "";
  let _apiKey  = "";
  let _storePfx = ""; // "wd_contractor_" or "wd_client_"
  let _loginUrl = "";

  // ── Init (called by shell) ──────────────────────────────────
  function init(config) {
    _apiUrl   = config.apiUrl;
    _apiKey   = config.apiKey;
    _storePfx = config.storePrefix || "wd_";
    _loginUrl = config.loginUrl    || "/app/contractor/login.html";
  }

  // ── API call ────────────────────────────────────────────────
  async function api(payload) {
    const body = new Blob(
      [JSON.stringify({ ...payload, apiKey: _apiKey })],
      { type: "text/plain" }
    );
    const res = await fetch(_apiUrl, { method: "POST", body });
    return res.json();
  }

  // ── Storage ─────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem(_storePfx + "token")
        || sessionStorage.getItem(_storePfx + "token");
  }

  function getUser() {
    const key = _storePfx + "user";
    const s   = localStorage.getItem(key) || sessionStorage.getItem(key);
    try { return s ? JSON.parse(s) : null; } catch(e) { return null; }
  }

  function setSession(token, user, remember) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(_storePfx + "token", token);
    store.setItem(_storePfx + "user",  JSON.stringify(user));
  }

  function clearSession() {
    [localStorage, sessionStorage].forEach(s => {
      s.removeItem(_storePfx + "token");
      s.removeItem(_storePfx + "user");
    });
  }

  // ── Auth guard ──────────────────────────────────────────────
  async function requireAuth(onSuccess) {
    const token = getToken();
    if (!token) {
      const cached = getUser();
      if (cached) { onSuccess(cached); return; }
      return redirect();
    }
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const body = new Blob(
        [JSON.stringify({ action: "contractor_validate_token", token, apiKey: _apiKey })],
        { type: "text/plain" }
      );
      const fetchRes = await fetch(_apiUrl, {
        method: "POST", body, signal: controller.signal
      });
      clearTimeout(tid);
      const res = await fetchRes.json();

      // Handle both contractor and client validate responses
      const user = res.contractor || res.client;
      if (res.success && user) {
        const store = localStorage.getItem(_storePfx + "token")
          ? localStorage : sessionStorage;
        store.setItem(_storePfx + "user", JSON.stringify(user));
        onSuccess(user);
      } else {
        const cached = getUser();
        if (cached) { onSuccess(cached); return; }
        redirect();
      }
    } catch(e) {
      const cached = getUser();
      if (cached) { onSuccess(cached); return; }
      redirect();
    }
  }

  function redirect() {
    window.location.href = _loginUrl;
  }

  // ── Logout ──────────────────────────────────────────────────
  async function logout(logoutAction) {
    const token = getToken();
    clearSession();
    if (token) {
      try { await api({ action: logoutAction || "contractor_logout", token }); } catch(e) {}
    }
    showToast("Signed out. See you soon!", "success");
    setTimeout(() => { window.location.href = _loginUrl; }, 900);
  }

  // ── Dark mode ────────────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem("wd_theme") || "light";
    applyTheme(saved, false);
  }

  function applyTheme(mode, save = true) {
    document.documentElement.setAttribute("data-mode", mode);
    if (save) localStorage.setItem("wd_theme", mode);
    // Sync toggle buttons if they exist
    document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function toggleTheme() {
    const current = localStorage.getItem("wd_theme") || "light";
    applyTheme(current === "light" ? "dark" : "light");
  }

  // ── Toast ────────────────────────────────────────────────────
  function showToast(msg, type = "") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const icons = {
      success: `<polyline points="20 6 9 17 4 12"/>`,
      error:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
      warn:    `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
      info:    `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`
    };

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" style="flex-shrink:0">
      ${icons[type] || icons.info}
    </svg>${escHtml(msg)}`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 350);
    }, 3800);
  }

  // ── Sidebar ──────────────────────────────────────────────────
  function openSidebar() {
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("sidebar-overlay")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebar-overlay")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ── User menu ─────────────────────────────────────────────────
  let _userMenuOpen = false;
  function toggleUserMenu() {
    _userMenuOpen = !_userMenuOpen;
    document.getElementById("user-menu")?.classList.toggle("open", _userMenuOpen);
  }
  function closeUserMenu() {
    _userMenuOpen = false;
    document.getElementById("user-menu")?.classList.remove("open");
  }

  // ── Boot sidebar with user data ──────────────────────────────
  function bootSidebar(user) {
    const first = user.firstName || "";
    const last  = user.lastName  || "";
    const init  = ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";

    const els = {
      "user-name":  (first + " " + last).trim() || "User",
      "user-email": user.email || "",
      "user-av":    init
    };

    Object.entries(els).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    // Subscription indicator
    const subBadge = document.getElementById("sub-badge");
    if (subBadge) {
      subBadge.style.display = user.hasSubscription ? "" : "none";
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────
  function openModal(id) {
    document.getElementById(id)?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ── Escape handler ────────────────────────────────────────────
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSidebar();
      closeUserMenu();
      // Close any open modal
      document.querySelectorAll(".modal-overlay.open")
        .forEach(m => m.classList.remove("open"));
      document.body.style.overflow = "";
    }
  });

  // Close user menu on outside click
  document.addEventListener("click", e => {
    if (!e.target.closest("#user-menu") && !e.target.closest("#user-pill")) {
      closeUserMenu();
    }
  });

  // ── Utility functions ─────────────────────────────────────────
  function escHtml(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function initials(name) {
    return (name || "?").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric"
      });
    } catch(e) { return iso; }
  }

  function fmtDateShort(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short", day: "numeric"
      });
    } catch(e) { return iso; }
  }

  function fmtCurrency(amount, currency = "USD") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency: currency || "USD",
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(amount || 0);
    } catch(e) { return "$" + (amount || 0); }
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return "Just now";
    if (m < 60)  return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24)  return h + "h ago";
    const d = Math.floor(h / 24);
    if (d < 7)   return d + "d ago";
    return fmtDate(iso);
  }

  function badgeHtml(status) {
    const map = {
      active:    "badge-active",
      draft:     "badge-draft",
      paused:    "badge-paused",
      completed: "badge-completed",
      cancelled: "badge-cancelled",
      ended:     "badge-ended",
      pending:   "badge-pending"
    };
    const cls    = map[status] || "badge-draft";
    const label  = status || "draft";
    return `<span class="badge ${cls}"><span class="badge-dot"></span>${escHtml(label)}</span>`;
  }

  function typePillHtml(type) {
    const icons = {
      "one-off":  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`,
      "hourly":   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><polyline points="12 8 12 12 15 14"/></svg>`,
      "retainer": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`
    };
    const cls   = type === "hourly" ? "hourly" : type === "retainer" ? "retainer" : "one-off";
    const label = type === "hourly" ? "Hourly" : type === "retainer" ? "Retainer" : "One-off";
    return `<span class="type-pill ${cls}">${icons[cls] || ""}${label}</span>`;
  }

  function avatarColor(str) {
    const colors = [
      "linear-gradient(135deg,#0a2918,#22c55e)",
      "linear-gradient(135deg,#1e3a5f,#3b82f6)",
      "linear-gradient(135deg,#4a0f2e,#ec4899)",
      "linear-gradient(135deg,#2d1b00,#f59e0b)",
      "linear-gradient(135deg,#1a0533,#8b5cf6)",
      "linear-gradient(135deg,#0f2620,#0d9488)"
    ];
    let hash = 0;
    for (let i = 0; i < (str || "").length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function fileIcon(type) {
    if (!type) return "📎";
    if (type === "link") return "🔗";
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    if (type.includes("video")) return "🎬";
    if (type.includes("sheet") || type.includes("excel")) return "📊";
    if (type.includes("word") || type.includes("document")) return "📝";
    if (type.includes("zip")) return "🗜️";
    return "📎";
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setBtnLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.classList.add("btn-loading");
      btn.disabled = true;
    } else {
      btn.classList.remove("btn-loading");
      btn.disabled = false;
    }
  }

  function fuzzyMatch(str, pattern) {
    if (!pattern) return true;
    str     = String(str || "").toLowerCase();
    pattern = String(pattern).toLowerCase();
    if (str.includes(pattern)) return true;
    return str.split(/[\s\-_]+/).some(w => w.startsWith(pattern));
  }

  // ── Subscription check helper ────────────────────────────────
  async function checkSubscription() {
    const token = getToken();
    if (!token) return false;
    try {
      const res = await api({ action: "get_subscription_status", token });
      return res.hasSubscription === true;
    } catch(e) {
      return false;
    }
  }

  // ── Show upgrade modal ────────────────────────────────────────
  async function showUpgradeModal() {
    let modal = document.getElementById("modal-upgrade");
    if (!modal) {
      modal = buildUpgradeModal();
      document.body.appendChild(modal);
    }
    openModal("modal-upgrade");

    // Load plans
    try {
      const res = await api({ action: "get_plans" });
      if (res.success) renderPlanCards(res.plans);
    } catch(e) {}
  }

  function buildUpgradeModal() {
    const el = document.createElement("div");
    el.className = "modal-overlay";
    el.id = "modal-upgrade";
    el.onclick = e => { if (e.target === el) closeModal("modal-upgrade"); };
    el.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title">Upgrade to create contracts</span>
          <button class="modal-close" onclick="WD.closeModal('modal-upgrade')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:0.84rem;color:var(--ink-3);line-height:1.6;margin-bottom:4px;">
            A workDez subscription is required to create contracts.
            Choose a plan that works for you.
          </p>
          <div class="plan-grid" id="upgrade-plan-grid">
            <div class="skeleton" style="height:120px;border-radius:12px;"></div>
            <div class="skeleton" style="height:120px;border-radius:12px;"></div>
            <div class="skeleton" style="height:120px;border-radius:12px;"></div>
            <div class="skeleton" style="height:120px;border-radius:12px;"></div>
          </div>
          <div id="upgrade-payment-section" style="display:none;margin-top:16px;">
            <div id="upgrade-payment-link-wrap" style="margin-bottom:14px;display:none;">
              <a id="upgrade-payment-link" href="#" target="_blank" rel="noopener"
                class="btn btn-primary" style="width:100%;justify-content:center;">
                Pay via payment link →
              </a>
            </div>
            <div style="position:relative;">
              <div style="position:absolute;inset:0;display:flex;align-items:center;">
                <div style="flex:1;height:1px;background:var(--border);"></div>
                <span style="padding:0 12px;font-size:0.74rem;color:var(--ink-4);">or upload proof of payment</span>
                <div style="flex:1;height:1px;background:var(--border);"></div>
              </div>
            </div>
            <div style="margin-top:28px;">
              <div class="field">
                <label class="field-label">Payment proof</label>
                <input type="file" id="upgrade-proof-file"
                  accept="image/*,.pdf"
                  style="height:auto;padding:10px;cursor:pointer;"
                  class="field-input">
              </div>
              <div class="field">
                <label class="field-label">Note <span class="opt">(optional)</span></label>
                <input type="text" id="upgrade-proof-note"
                  placeholder="e.g. Transaction ID, any notes..."
                  class="field-input">
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="WD.closeModal('modal-upgrade')">Cancel</button>
          <button class="btn btn-primary" id="upgrade-submit-btn"
            onclick="WD._submitUpgrade()" style="display:none;">
            <span class="btn-label">Submit payment proof</span>
          </button>
        </div>
      </div>`;
    return el;
  }

  let _selectedPlan = null;

  function renderPlanCards(plans) {
    const grid = document.getElementById("upgrade-plan-grid");
    if (!grid) return;

    const bestValue = plans.find(p => p.plan === "annual") || plans[plans.length - 1];

    grid.innerHTML = plans.map(plan => {
      const isBest = plan.id === bestValue.id;
      return `<div class="plan-card ${isBest ? "best-value" : ""}"
        data-plan="${escHtml(plan.plan)}"
        data-payment-link="${escHtml(plan.paymentLink || "")}"
        onclick="WD._selectPlan(this, '${escHtml(plan.plan)}', '${escHtml(plan.paymentLink || "")}')">
        <div class="plan-duration">${escHtml(plan.label)}</div>
        <div class="plan-price">$${plan.amount}<span> ${escHtml(plan.currency || "USD")}</span></div>
        <div class="plan-per">${plan.durationMonths === 1 ? "per month" :
          "for " + plan.durationMonths + " months"}</div>
      </div>`;
    }).join("");
  }

  function _selectPlan(el, plan, paymentLink) {
    _selectedPlan = plan;
    document.querySelectorAll(".plan-card").forEach(c => c.classList.remove("selected"));
    el.classList.add("selected");

    const section = document.getElementById("upgrade-payment-section");
    const linkWrap = document.getElementById("upgrade-payment-link-wrap");
    const linkEl   = document.getElementById("upgrade-payment-link");
    const submitBtn = document.getElementById("upgrade-submit-btn");

    if (section) section.style.display = "";
    if (submitBtn) submitBtn.style.display = "";

    if (paymentLink && linkWrap && linkEl) {
      linkWrap.style.display = "";
      linkEl.href = paymentLink;
    } else if (linkWrap) {
      linkWrap.style.display = "none";
    }
  }

  async function _submitUpgrade() {
    if (!_selectedPlan) { showToast("Please select a plan", "warn"); return; }

    const btn       = document.getElementById("upgrade-submit-btn");
    const fileInput = document.getElementById("upgrade-proof-file");
    const note      = document.getElementById("upgrade-proof-note")?.value.trim() || "";

    setBtnLoading(btn, true);

    try {
      const payload = {
        action:        "submit_subscription",
        token:         getToken(),
        plan:          _selectedPlan,
        paymentMethod: "manual",
        paymentNote:   note
      };

      if (fileInput?.files[0]) {
        const file  = fileInput.files[0];
        payload.proofBase64   = await fileToBase64(file);
        payload.proofFileName = file.name;
        payload.proofMimeType = file.type;
      }

      const res = await api(payload);

      if (res.success) {
        closeModal("modal-upgrade");
        showToast("Payment proof submitted! We'll activate your plan within 24 hours.", "success");
      } else {
        showToast(res.error || "Failed to submit", "error");
      }
    } catch(e) {
      showToast("Connection error. Please try again.", "error");
    } finally {
      setBtnLoading(btn, false);
    }
  }

  // ── Expose globals for inline onclick handlers ────────────────
  window.WD = {
    // Core
    api, getToken, getUser, setSession, clearSession,
    requireAuth, logout, redirect,

    // Theme
    initTheme, applyTheme, toggleTheme,

    // UI
    showToast, openSidebar, closeSidebar,
    toggleUserMenu, closeUserMenu,
    bootSidebar, openModal, closeModal,
    setBtnLoading, showUpgradeModal,

    // Upgrade (internal but exposed for onclick)
    _selectPlan, _submitUpgrade,

    // Formatters
    escHtml, initials, fmtDate, fmtDateShort, fmtCurrency,
    timeAgo, badgeHtml, typePillHtml, avatarColor,
    fileIcon, fileToBase64, fuzzyMatch,

    // Subscription
    checkSubscription,

    // Init
    init
  };

  return window.WD;

})();
