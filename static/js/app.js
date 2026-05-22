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
    TimiDiary.switchView("table");
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

    // —— 块编辑器 ——
    if (typeof TimiBlocks !== "undefined") {
      TimiBlocks.init();
      TimiBlocks.addBlockToolbar();
      TimiBlocks.onChange(() => TimiDiary.updateCurrentWordCount());
    }

    const drawer = document.getElementById("page-settings-drawer");
    const backdrop = document.getElementById("settings-backdrop");
    function openPageSettings() {
      drawer?.classList.add("is-open");
      backdrop?.classList.remove("hidden");
    }
    function closePageSettings() {
      drawer?.classList.remove("is-open");
      backdrop?.classList.add("hidden");
    }
    document.getElementById("btn-page-settings")?.addEventListener("click", openPageSettings);
    document.getElementById("btn-close-settings")?.addEventListener("click", closePageSettings);
    backdrop?.addEventListener("click", closePageSettings);

    document.getElementById("field-title")?.addEventListener("input", () => {
      TimiDiary.syncPageTitleFromField();
    });
    document.getElementById("field-mood-custom")?.addEventListener("input", () => {
      TimiDiary.updateMoodBadge();
    });

    function startNewDiary() {
      TimiDiary.clearEditor();
      TimiDiary.switchView("write");
      if (typeof TimiBlocks !== "undefined") {
        const el = TimiBlocks.insertAtEnd({ type: "text", content: "" });
        el?.querySelector(".block-body")?.focus();
      }
      toast("输入 / 可插入标题、列表、待办等块");
    }

    document.getElementById("btn-new").addEventListener("click", startNewDiary);
    document.getElementById("btn-sidebar-new")?.addEventListener("click", startNewDiary);

    document.getElementById("btn-pages-collapse")?.addEventListener("click", () => {
      document.getElementById("sidebar-pages")?.classList.toggle("collapsed");
    });

    document.querySelectorAll(".view-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const v = tab.dataset.view;
        TimiDiary.switchView(v);
        if (v === "board" && typeof TimiViews !== "undefined") TimiViews.renderBoard();
        if (v === "calendar" && typeof TimiViews !== "undefined") TimiViews.renderCalendar();
        if (v === "write") {
          setTimeout(() => document.querySelector(".block-body")?.focus(), 80);
        } else {
          closePageSettings();
        }
      });
    });

    document.getElementById("btn-sidebar-folder")?.addEventListener("click", async () => {
      const name = prompt("文件夹名称", "新文件夹");
      if (!name) return;
      try {
        await TimiApi.post("/api/folders", { name, icon: "📁" });
        await TimiDiary.refreshAll();
        toast("文件夹已创建");
      } catch (e) {
        toast(e.message || "创建失败");
      }
    });

    const dlgSearch = document.getElementById("dialog-search");
    const qInput = document.getElementById("quick-find-input");
    const qResults = document.getElementById("quick-find-results");

    async function runQuickFind(q) {
      if (!q.trim()) {
        qResults.innerHTML = "";
        return;
      }
      const res = await TimiApi.get(`/api/search?q=${encodeURIComponent(q)}`);
      qResults.innerHTML = "";
      (res.data || []).forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${item.title || "无标题"}</strong><span>${item.date}</span>`;
        li.addEventListener("click", () => {
          dlgSearch.close();
          TimiDiary.openEntry(item.id);
        });
        qResults.appendChild(li);
      });
      if (!res.data?.length) qResults.innerHTML = '<li class="muted">无结果</li>';
    }

    document.getElementById("btn-quick-find")?.addEventListener("click", () => {
      dlgSearch.showModal();
      qInput.value = "";
      qInput.focus();
    });
    document.getElementById("btn-close-search")?.addEventListener("click", () => dlgSearch.close());
    qInput?.addEventListener("input", () => runQuickFind(qInput.value));
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dlgSearch?.showModal();
        qInput?.focus();
      }
    });

    const dlgTpl = document.getElementById("dialog-template");
    document.getElementById("btn-template")?.addEventListener("click", async () => {
      const res = await TimiApi.get("/api/templates");
      const list = document.getElementById("template-list");
      list.innerHTML = "";
      Object.entries(res.data || {}).forEach(([key, tpl]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "template-item";
        btn.innerHTML = `<span>${tpl.icon}</span> ${tpl.name}`;
        btn.addEventListener("click", () => {
          TimiDiary.clearEditor();
          if (typeof TimiBlocks !== "undefined") TimiBlocks.setBlocks(tpl.blocks);
          TimiDiary.switchView("write");
          dlgTpl.close();
          toast(`已应用模板：${tpl.name}`);
        });
        list.appendChild(btn);
      });
      dlgTpl.showModal();
    });
    document.getElementById("btn-close-template")?.addEventListener("click", () => dlgTpl.close());

    document.getElementById("btn-export-md")?.addEventListener("click", () => {
      const id = TimiDiary.state.currentId;
      if (!id) {
        toast("请先选择一篇日记");
        return;
      }
      TimiApi.download(`/api/export/${id}/md`, `diary_${id.slice(0, 8)}.md`);
    });

    document.getElementById("filter-keyword")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") TimiDiary.loadList(1);
    });

    document.getElementById("btn-save").addEventListener("click", async () => {
      try {
        const { isUpdate } = await TimiDiary.save();
        toast(
          isUpdate
            ? "已更新当前篇（新篇请先点「新建」）"
            : "新日记已保存，可继续书写下一篇"
        );
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
      TimiDiary.switchView("table");
      TimiDiary.updateTagFilterUI();
    });

    document.getElementById("btn-clear-tag-filter")?.addEventListener("click", () => {
      TimiDiary.setTagFilter("");
      TimiDiary.refreshAll();
    });

    document.getElementById("filter-tag")?.addEventListener("change", () => {
      TimiDiary.updateTagFilterUI();
      TimiDiary.renderSidebarTags();
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
