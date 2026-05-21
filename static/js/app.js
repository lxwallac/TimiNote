/**
 * 应用入口：绑定事件、主题、初始化流程
 */
(function () {
  const boot = window.TIMI_BOOT || {};

  function toast(msg, duration = 2800) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add("hidden"), duration);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("timi_theme", theme);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "light" ? "dark" : "light";
    applyTheme(next);
    TimiApi.put("/api/theme", { theme: next }).catch(() => {});
  }

  function updatePasswordButtons(passwordEnabled) {
    document.getElementById("btn-enable-password").classList.toggle("hidden", passwordEnabled);
    document.getElementById("btn-change-password").classList.toggle("hidden", !passwordEnabled);
  }

  async function onUnlocked() {
    document.getElementById("auth-overlay").classList.add("hidden");
    const status = await TimiAuth.refreshStatus();
    updatePasswordButtons(status.password_enabled);
    applyTheme(status.theme || boot.theme || "light");
    TimiDiary.state.tagsCatalog = status.tags_catalog || [];
    TimiDiary.renderMoodPicker(status.moods || []);
    TimiDiary.buildFilterMoods();
    TimiDiary.renderTagCatalog();
    TimiDiary.clearEditor();
    await TimiDiary.loadStats();
    await TimiDiary.loadList(1);
  }

  async function init() {
    applyTheme(localStorage.getItem("timi_theme") || boot.theme || "light");

    // —— 认证 ——
    document.getElementById("btn-setup").addEventListener("click", async () => {
      const p = document.getElementById("setup-password").value;
      const c = document.getElementById("setup-confirm").value;
      try {
        await TimiAuth.setup(p, c);
        TimiAuth.setMsg("设置成功", false);
        await onUnlocked();
      } catch (e) {
        TimiAuth.setMsg(e.message || "设置失败");
      }
    });

    document.getElementById("btn-skip").addEventListener("click", async () => {
      document.getElementById("auth-overlay").classList.add("hidden");
      await onUnlocked();
    });

    document.getElementById("btn-login").addEventListener("click", async () => {
      const p = document.getElementById("login-password").value;
      try {
        await TimiAuth.login(p);
        TimiAuth.setMsg("解锁成功", false);
        await onUnlocked();
      } catch (e) {
        TimiAuth.setMsg(e.message || "密码错误");
      }
    });

    document.getElementById("btn-lock").addEventListener("click", async () => {
      await TimiAuth.logout();
      location.reload();
    });

    // —— 编辑器 ——
    document.getElementById("field-content").addEventListener("input", () => {
      TimiDiary.updateCurrentWordCount();
    });

    document.getElementById("btn-new").addEventListener("click", () => {
      TimiDiary.clearEditor();
      toast("已新建空白日记");
    });

    document.getElementById("btn-save").addEventListener("click", async () => {
      try {
        await TimiDiary.save();
        toast("日记已保存");
      } catch (e) {
        toast(e.message || "保存失败");
      }
    });

    document.getElementById("btn-clear-editor").addEventListener("click", () => {
      if (confirm("确定清空当前编辑区？未保存内容将丢失。")) {
        TimiDiary.clearEditor();
      }
    });

    document.getElementById("btn-delete").addEventListener("click", async () => {
      if (!TimiDiary.state.currentId) {
        toast("请先选择或保存一篇日记");
        return;
      }
      if (!confirm("确定永久删除本篇日记？")) return;
      try {
        await TimiDiary.remove();
        await TimiDiary.loadList(1);
        toast("已删除");
      } catch (e) {
        toast(e.message || "删除失败");
      }
    });

    document.getElementById("field-tag-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const tag = e.target.value.trim();
        if (tag) TimiDiary.toggleTag(tag);
        e.target.value = "";
      }
    });

    document.getElementById("btn-add-catalog-tag").addEventListener("click", () => {
      TimiDiary.addTagToCatalog().then(() => toast("标签已加入标签库"));
    });

    document.getElementById("btn-search").addEventListener("click", () => {
      TimiDiary.loadList(1);
    });

    document.getElementById("btn-theme").addEventListener("click", toggleTheme);

    document.getElementById("btn-export-all").addEventListener("click", () => {
      TimiApi.download("/api/export/all", "diary_export_all.txt");
      toast("正在导出全部日记…");
    });

    document.getElementById("btn-export-one").addEventListener("click", () => {
      const id = TimiDiary.state.currentId;
      if (!id) {
        toast("请先选择一篇日记");
        return;
      }
      TimiApi.download(`/api/export/${id}`, `diary_${id.slice(0, 8)}.txt`);
    });

    // —— 改密 ——
    const dlg = document.getElementById("dialog-password");
    document.getElementById("btn-enable-password").addEventListener("click", () => {
      TimiAuth.showSetupMode();
      TimiAuth.showOverlay(true);
      document.getElementById("auth-setup").classList.remove("hidden");
      document.getElementById("auth-login").classList.add("hidden");
      document.getElementById("btn-skip").classList.remove("hidden");
    });

    document.getElementById("btn-change-password").addEventListener("click", () => {
      dlg.showModal();
    });
    document.getElementById("btn-cancel-password").addEventListener("click", () => {
      dlg.close();
    });
    document.getElementById("form-change-password").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await TimiAuth.changePassword(fd.get("old"), fd.get("new"), fd.get("confirm"));
        dlg.close();
        toast("密码已更新");
      } catch (err) {
        toast(err.message || "修改失败");
      }
    });

    // —— 启动 ——
    try {
      const status = await TimiAuth.refreshStatus();
      if (status.password_enabled && !status.unlocked) {
        TimiAuth.showLoginMode(true);
        TimiAuth.showOverlay(true);
      } else if (!status.password_enabled) {
        TimiAuth.showSetupMode();
        if (boot.showSetup !== false) TimiAuth.showOverlay(true);
        else await onUnlocked();
      } else {
        await onUnlocked();
      }
    } catch (_) {
      toast("无法连接服务，请确认已运行 python app.py");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
