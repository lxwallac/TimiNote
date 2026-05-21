/**
 * 登录、设密、锁定与改密
 */
const TimiAuth = (() => {
  const overlay = () => document.getElementById("auth-overlay");
  const setupBlock = () => document.getElementById("auth-setup");
  const loginBlock = () => document.getElementById("auth-login");
  const msgEl = () => document.getElementById("auth-message");

  function showOverlay(show) {
    overlay().classList.toggle("hidden", !show);
  }

  function setMsg(text, isError = true) {
    const el = msgEl();
    el.textContent = text || "";
    el.style.color = isError ? "" : "var(--accent)";
  }

  async function refreshStatus() {
    const res = await TimiApi.get("/api/auth/status");
    return res;
  }

  async function setup(password, confirm) {
    return TimiApi.post("/api/auth/setup", { password, confirm });
  }

  async function login(password) {
    return TimiApi.post("/api/auth/login", { password });
  }

  async function logout() {
    return TimiApi.post("/api/auth/logout");
  }

  async function changePassword(oldPassword, newPassword, confirm) {
    return TimiApi.post("/api/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
      confirm,
    });
  }

  function showLoginMode(passwordEnabled) {
    setupBlock().classList.add("hidden");
    loginBlock().classList.remove("hidden");
    if (!passwordEnabled) {
      showOverlay(false);
    }
  }

  function showSetupMode() {
    setupBlock().classList.remove("hidden");
    loginBlock().classList.add("hidden");
  }

  return {
    showOverlay,
    setMsg,
    refreshStatus,
    setup,
    login,
    logout,
    changePassword,
    showLoginMode,
    showSetupMode,
  };
})();
