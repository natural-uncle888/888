/**
 * On-device authentication for a static SPA (Order Queuing 888).
 * - Master password hash stored in localStorage
 * - Optional "saved password" (per user requirement) stored in localStorage
 * - Session authenticated flag stored in sessionStorage (per tab)
 * - Optional enable/disable gate stored in localStorage
 */
(() => {
  const LS_MASTER_HASH  = 'yl_auth_master_hash_v1';
  const LS_ADMIN_HASH   = 'yl_auth_admin_hash_v1';
  const LS_SAVED_PWD    = 'yl_auth_saved_pwd_v1';
  const LS_ENABLED      = 'yl_auth_enabled_v1';
  const SS_OK           = 'yl_auth_session_ok_v1';
  const SS_ADMIN_OK     = 'yl_auth_admin_session_ok_v1';

  // ---------------- Utilities ----------------
  async function sha256Hex(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function getMasterHash() {
    return localStorage.getItem(LS_MASTER_HASH);
  }

  function setMasterHash(hash) {
    localStorage.setItem(LS_MASTER_HASH, hash);
  }

  function setSessionOk(v) {
    if (v) sessionStorage.setItem(SS_OK, '1');
    else sessionStorage.removeItem(SS_OK);
  }

  function isAuthed() {
    return sessionStorage.getItem(SS_OK) === '1';
  }

  function hasPasswordSetup() {
    return !!getMasterHash();
  }

  // enabled default: if a master password exists, enabled unless explicitly turned off

  function getAdminHash() {
    return localStorage.getItem(LS_ADMIN_HASH);
  }

  function setAdminHash(hash) {
    if (!hash) localStorage.removeItem(LS_ADMIN_HASH);
    else localStorage.setItem(LS_ADMIN_HASH, hash);
  }

  function hasAdminSetup() {
    return !!getAdminHash();
  }

  function isAdminAuthed() {
    return sessionStorage.getItem(SS_ADMIN_OK) === '1';
  }

  function setAdminSessionOk(v) {
    if (v) sessionStorage.setItem(SS_ADMIN_OK, '1');
    else sessionStorage.removeItem(SS_ADMIN_OK);
  }

  function isEnabled() {
    const v = localStorage.getItem(LS_ENABLED);
    if (v === null) return hasPasswordSetup();
    return v === '1';
  }

  function setEnabled(v) {
    localStorage.setItem(LS_ENABLED, v ? '1' : '0');
    if (!v) setSessionOk(false);
    refreshSettingsUi();
  }

  function getSavedPassword() {
    return localStorage.getItem(LS_SAVED_PWD) || '';
  }

  function setSavedPassword(pwd) {
    if (pwd) localStorage.setItem(LS_SAVED_PWD, pwd);
    else localStorage.removeItem(LS_SAVED_PWD);
  }

  function clearSavedPassword() {
    localStorage.removeItem(LS_SAVED_PWD);
    refreshSettingsUi();
  }

  function logout() {
    setSessionOk(false);
    setAdminSessionOk(false);
    if (isEnabled()) openLogin();
    refreshSettingsUi();
  }

  // Hard reset: clear stored credentials on this origin (Netlify domain),
  // then reopen login in setup mode. Intended for admin recovery only.
  
  // Hard reset: clear stored credentials on this origin (Netlify domain),
  // then reopen login in setup mode. Intended for admin recovery only.
  function hardResetCredentials() {
    // Prefer a styled in-app modal; fall back to native confirm if modal is missing.
    const modal = document.getElementById('resetConfirmModal');
    if (!modal) {
      const ok = confirm('即將清除本裝置在此網站的所有登入密碼設定（一般密碼 / 管理者密碼 / 記住的密碼）。\n\n清除後需要重新設定密碼才能登入。\n\n確定要繼續嗎？');
      if (!ok) return;
      return doHardReset();
    }

    // One-time wiring
    if (!hardResetCredentials.__inited) {
      const closeBtn = document.getElementById('resetConfirmCloseBtn');
      const cancelBtn = document.getElementById('resetConfirmCancelBtn');
      const okBtn = document.getElementById('resetConfirmOkBtn');
      const backdrop = modal.querySelector('.modal-backdrop');

      const close = () => {
        modal.setAttribute('aria-hidden', 'true');
        hardResetCredentials.__pending = null;
      };

      const open = (onOk) => {
        hardResetCredentials.__pending = onOk;
        modal.setAttribute('aria-hidden', 'false');
      };

      // expose internally
      hardResetCredentials.__open = open;
      hardResetCredentials.__close = close;

      closeBtn && closeBtn.addEventListener('click', close);
      cancelBtn && cancelBtn.addEventListener('click', close);
      backdrop && backdrop.addEventListener('click', (e) => {
        // only close when clicking the backdrop itself
        if (e && e.target && (e.target.getAttribute('data-close') === 'true')) close();
      });

      okBtn && okBtn.addEventListener('click', () => {
        const fn = hardResetCredentials.__pending;
        close();
        if (typeof fn === 'function') fn();
      });

      // ESC to close
      document.addEventListener('keydown', (e) => {
        if (e && e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') close();
      });

      hardResetCredentials.__inited = true;
    }

    // Open confirm modal
    hardResetCredentials.__open(() => doHardReset());
  }

  function doHardReset() {
    // Clear hashes & saved password
    localStorage.removeItem(LS_MASTER_HASH);
    localStorage.removeItem(LS_ADMIN_HASH);
    localStorage.removeItem(LS_SAVED_PWD);

    // Clear gate/session flags
    sessionStorage.removeItem(SS_OK);
    sessionStorage.removeItem(SS_ADMIN_OK);

    // Also clear enable toggle if present
    localStorage.removeItem(LS_ENABLED);

    // After clearing, force the login overlay to reopen in setup mode.
    // Do NOT rely on a full reload, because the app may not automatically
    // open the overlay when auth is disabled.
    setSessionOk(false);
    setAdminSessionOk(false);
    try { closeAuthSettings(); } catch (_) {}
    refreshSettingsUi();
    openLogin();
  }


  // ---------------- Login Overlay ----------------
  const overlay = document.getElementById('authOverlay');
  const form = document.getElementById('authForm');
  const pwdInput = document.getElementById('authPassword');
  const toggleBtn = document.getElementById('authToggle');
  const rememberChk = document.getElementById('authRemember');
  const adminModeChk = document.getElementById('authAdminMode');
  const clearSavedBtn = document.getElementById('authClearSaved');
  const subtitle = document.getElementById('authSubtitle');
  const setupWrap = document.getElementById('authSetupWrap');
  const setupPwd2 = document.getElementById('authPassword2');
  const submitBtn = document.getElementById('authSubmit');
  const errorBox = document.getElementById('authError');

  function showOverlay(el, visible) {
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function setError(msg, target = errorBox) {
    if (!target) return;
    target.textContent = msg || '';
    target.style.display = msg ? 'block' : 'none';
  }

  function setLoginMode(mode) {
    // mode: 'login' | 'setup' | 'login_admin' | 'setup_admin'
    const isAdmin = (mode === 'login_admin' || mode === 'setup_admin');
    const isSetup = (mode === 'setup' || mode === 'setup_admin');

    if (subtitle) {
      if (isAdmin && isSetup) subtitle.textContent = '首次使用請先設定「管理者」密碼';
      else if (isAdmin) subtitle.textContent = '管理者登入';
      else if (isSetup) subtitle.textContent = '首次使用請先設定密碼';
      else subtitle.textContent = '請登入以繼續';
    }

    if (setupWrap) setupWrap.style.display = isSetup ? 'block' : 'none';
    if (pwdInput) pwdInput.value = getSavedPassword() || '';
    if (rememberChk) rememberChk.checked = !!getSavedPassword();
    if (setupPwd2) setupPwd2.value = '';
    if (submitBtn) submitBtn.textContent = isSetup ? '設定密碼並進入' : (isAdmin ? '管理者登入' : '登入');
    setError('');
  }


  async function verifyPassword(inputPwd) {
    const hash = getMasterHash();
    if (!hash) return false;
    const inHash = await sha256Hex(inputPwd);
    return inHash === hash;
  }


  async function verifyAdminPassword(inputPwd) {
    const hash = getAdminHash();
    if (!hash) return false;
    const inHash = await sha256Hex(inputPwd);
    return inHash === hash;
  }

  function openLogin() {
    if (!overlay) return;
    const adminMode = !!(adminModeChk && adminModeChk.checked);
    const mode = adminMode
      ? (hasAdminSetup() ? 'login_admin' : 'setup_admin')
      : (hasPasswordSetup() ? 'login' : 'setup');
    setLoginMode(mode);
    showOverlay(overlay, true);
    setTimeout(() => pwdInput && pwdInput.focus(), 50);
  }

  function closeLogin() {
    showOverlay(overlay, false);
  }

  // ---------------- Auth Settings Overlay ----------------
  const settingsOverlay = document.getElementById('authSettingsOverlay');
  const settingsForm = document.getElementById('authSettingsForm');
  const curPwd = document.getElementById('authCurrentPassword');
  const newPwd = document.getElementById('authNewPassword');
  const newPwd2 = document.getElementById('authNewPassword2');
  const updateSavedChk = document.getElementById('authUpdateSavedPwd');
  const settingsCancel = document.getElementById('authSettingsCancel');
  const settingsErr = document.getElementById('authSettingsError');

  function openAuthSettings() {
    if (!settingsOverlay) return;

    if (!isAdminAuthed()) {
      alert('僅管理者可查看「登入 / 安全」。');
      return;
    }
    if (!hasPasswordSetup()) {
      // If user never set password, open setup directly
      openLogin();
      return;
    }
    showOverlay(settingsOverlay, true);
    if (curPwd) curPwd.value = '';
    if (newPwd) newPwd.value = '';
    if (newPwd2) newPwd2.value = '';
    if (updateSavedChk) updateSavedChk.checked = !!getSavedPassword();
    setError('', settingsErr);
    setTimeout(() => curPwd && curPwd.focus(), 50);
  }

  function closeAuthSettings() {
    showOverlay(settingsOverlay, false);
  }

  function bindToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '隱藏' : '顯示';
    });
  }

  // ---------------- Settings Panel Entrance ----------------
  const uiEnabledToggle = document.getElementById('authEnabledToggle');
  const uiChangeBtn = document.getElementById('authChangePwdBtn');
  const uiLogoutBtn = document.getElementById('authLogoutBtn');
  const uiClearBtn = document.getElementById('authClearSavedBtn');
  const uiHint = document.getElementById('authSettingsHint');

  function refreshSettingsUi() {
    if (uiEnabledToggle) {
      uiEnabledToggle.checked = isEnabled();
      uiEnabledToggle.disabled = !hasPasswordSetup(); // no password => gate irrelevant (yet)
    }
    // Allow password setup via the settings button when no password exists yet.
    // openAuthSettings() will route to setup flow in that case.
    if (uiChangeBtn) uiChangeBtn.disabled = false;
    if (uiLogoutBtn) uiLogoutBtn.disabled = !hasPasswordSetup() || !isEnabled();
    if (uiClearBtn) uiClearBtn.disabled = !getSavedPassword();

    if (uiHint) {
      if (!hasPasswordSetup()) {
        uiHint.textContent = '尚未設定登入密碼：請先點「變更密碼」完成首次設定。';
      } else if (!isEnabled()) {
        uiHint.textContent = '登入保護目前為關閉（此裝置可直接進入系統）。';
      } else if (isAuthed()) {
        uiHint.textContent = '你目前已登入。若要切換帳務或交接，可點「登出」。';
      } else {
        uiHint.textContent = '登入保護已啟用：重新開啟頁面後需要輸入密碼。';
      }
    }
    // Show "登入 / 安全" settings only for admin session
    const authGroup = document.getElementById('authSettingsGroup');
    if (authGroup) {
      authGroup.style.display = isAdminAuthed() ? '' : 'none';
    }

  }

  // ---------------- Event bindings ----------------
  function init() {
    // Login overlay binding
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const show = pwdInput.type === 'password';
        pwdInput.type = show ? 'text' : 'password';
        toggleBtn.textContent = show ? '隱藏' : '顯示';
      });
    }

    if (clearSavedBtn) {
      clearSavedBtn.addEventListener('click', () => {
        clearSavedPassword();
        if (pwdInput) pwdInput.value = '';
        if (rememberChk) rememberChk.checked = false;
      });
    }

    if (adminModeChk) {
      adminModeChk.addEventListener('change', () => {
        const adminMode = !!adminModeChk.checked;
        const mode = adminMode
          ? (hasAdminSetup() ? 'login_admin' : 'setup_admin')
          : (hasPasswordSetup() ? 'login' : 'setup');
        setLoginMode(mode);
      });
    }


    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = (pwdInput?.value || '').trim();
        if (!pwd) return setError('請輸入密碼。');


        const adminMode = !!(adminModeChk && adminModeChk.checked);

        // ----- Admin mode -----
        if (adminMode) {
          const setupAdmin = !hasAdminSetup();
          if (setupAdmin) {
            const pwd2 = (setupPwd2?.value || '').trim();
            if (pwd.length < 4) return setError('密碼至少 4 碼。');
            if (!pwd2) return setError('請再次輸入密碼。');
            if (pwd !== pwd2) return setError('兩次密碼不一致。');

            const hash = await sha256Hex(pwd);
            setAdminHash(hash);

            if (rememberChk?.checked) setSavedPassword(pwd);
            else setSavedPassword('');

            setAdminSessionOk(true);
            setSessionOk(true);
            closeLogin();
            refreshSettingsUi();
            return;
          }

          const ok = await verifyAdminPassword(pwd);
          if (!ok) return setError('管理者密碼錯誤，請再試一次。');

          if (rememberChk?.checked) setSavedPassword(pwd);
          else setSavedPassword('');

          setAdminSessionOk(true);
          setSessionOk(true);
          closeLogin();
          refreshSettingsUi();
          return;
        }

        // ----- Normal mode -----
        const setupMode = !hasPasswordSetup();
        if (setupMode) {
          const pwd2 = (setupPwd2?.value || '').trim();
          if (pwd.length < 4) return setError('密碼至少 4 碼。');
          if (!pwd2) return setError('請再次輸入密碼。');
          if (pwd !== pwd2) return setError('兩次密碼不一致。');

          const hash = await sha256Hex(pwd);
          setMasterHash(hash);
          // default enable after setup
          localStorage.setItem(LS_ENABLED, '1');

          if (rememberChk?.checked) setSavedPassword(pwd);
          else setSavedPassword('');

          setAdminSessionOk(false);


          setSessionOk(true);
          closeLogin();
          refreshSettingsUi();
          return;
        }

        // login mode
        const ok = await verifyPassword(pwd);
        if (!ok) return setError('密碼錯誤，請再試一次。');

        if (rememberChk?.checked) setSavedPassword(pwd);
        else setSavedPassword('');

        setAdminSessionOk(false);

        setSessionOk(true);
        closeLogin();
        refreshSettingsUi();
      });
    }

    // Auth settings overlay binding
    bindToggle('authSettingsToggle1', 'authCurrentPassword');
    bindToggle('authSettingsToggle2', 'authNewPassword');
    bindToggle('authSettingsToggle3', 'authNewPassword2');

    if (settingsCancel) settingsCancel.addEventListener('click', closeAuthSettings);

    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('', settingsErr);

        const cur = (curPwd?.value || '').trim();
        const n1 = (newPwd?.value || '').trim();
        const n2 = (newPwd2?.value || '').trim();

        if (!cur) return setError('請輸入目前密碼。', settingsErr);
        const ok = await verifyPassword(cur);
        if (!ok) return setError('目前密碼不正確。', settingsErr);

        if (!n1 || !n2) return setError('請輸入並確認新密碼。', settingsErr);
        if (n1.length < 4) return setError('新密碼至少 4 碼。', settingsErr);
        if (n1 !== n2) return setError('兩次新密碼不一致。', settingsErr);

        const hash = await sha256Hex(n1);
        setMasterHash(hash);

        // keep enabled as-is; ensure enabled on change if already setup
        if (localStorage.getItem(LS_ENABLED) === null) localStorage.setItem(LS_ENABLED, '1');

        // update saved password optionally
        if (updateSavedChk?.checked) setSavedPassword(n1);

        // changing password invalidates existing tab session; require re-login if enabled
        setSessionOk(false);
        closeAuthSettings();
        refreshSettingsUi();

        if (isEnabled()) openLogin();
      });
    }

    // Settings panel entrance binding
    if (uiEnabledToggle) {
      uiEnabledToggle.addEventListener('change', () => {
        if (!hasPasswordSetup()) return;
        setEnabled(uiEnabledToggle.checked);
      });
    }
    if (uiChangeBtn) uiChangeBtn.addEventListener('click', openAuthSettings);
    if (uiLogoutBtn) uiLogoutBtn.addEventListener('click', logout);
    if (uiClearBtn) uiClearBtn.addEventListener('click', clearSavedPassword);

    // Initial UI refresh
    refreshSettingsUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose minimal API
  window.Auth = {
    isAuthed,
    isEnabled,
    setEnabled,
    openLogin,
    openAuthSettings,
    logout,
    clearSavedPassword,
    isAdminAuthed,
    hardResetCredentials
  };
})();
