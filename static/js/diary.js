/**
 * 日记编辑、列表、分页、统计、标签与心情
 */
const TimiDiary = (() => {
  let state = {
    currentId: null,
    selectedTags: [],
    selectedMood: "",
    moods: [],
    tagsCatalog: [],
    page: 1,
    pages: 1,
    perPage: 8,
    folders: [],
    createParentId: "",
    createFolderId: "",
    tagCounts: {},
    allItemsCache: [],
  };

  const $ = (id) => document.getElementById(id);

  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function countWords(text) {
    return (text || "").replace(/\s/g, "").length;
  }

  function updateCurrentWordCount() {
    const n =
      typeof TimiBlocks !== "undefined" ? TimiBlocks.countWords() : countWords($("field-content")?.value || "");
    $("stat-current").textContent = n;
  }

  function getEditorPayload() {
    if (typeof TimiBlocks !== "undefined") {
      return {
        blocks: TimiBlocks.collectBlocks(),
        content: TimiBlocks.getPlainText(),
      };
    }
    const text = $("field-content")?.value || "";
    return { blocks: null, content: text };
  }

  function updateStats(stats) {
    if (!stats) return;
    $("stat-words").textContent = stats.total_words ?? 0;
    $("stat-entries").textContent = stats.total_entries ?? 0;
    $("stat-days").textContent = stats.writing_days ?? 0;
  }

  async function loadStats() {
    try {
      const res = await TimiApi.get("/api/stats");
      updateStats(res.data);
    } catch (_) { /* 未解锁时忽略 */ }
  }

  function renderMoodPicker(moods) {
    state.moods = moods;
    const box = $("mood-picker");
    box.innerHTML = "";
    moods.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mood-btn";
      btn.textContent = m;
      btn.dataset.mood = m;
      btn.addEventListener("click", () => selectMood(m));
      box.appendChild(btn);
    });
  }

  function selectMood(m) {
    state.selectedMood = m;
    $("field-mood-custom").value = "";
    document.querySelectorAll(".mood-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === m);
    });
    updateMoodBadge();
  }

  function getMood() {
    const custom = $("field-mood-custom").value.trim();
    return custom || state.selectedMood || "";
  }

  function renderTagCatalog() {
    const catalog = $("tag-catalog");
    catalog.innerHTML = "";
    state.tagsCatalog.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      chip.addEventListener("click", () => toggleTag(tag));
      catalog.appendChild(chip);
    });
    const filterTag = $("filter-tag");
    const cur = filterTag.value;
    filterTag.innerHTML = '<option value="">全部标签</option>';
    state.tagsCatalog.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      filterTag.appendChild(opt);
    });
    filterTag.value = cur;
  }

  function renderSelectedTags() {
    const box = $("selected-tags");
    box.innerHTML = "";
    state.selectedTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip selected";
      chip.innerHTML = `${tag} <button type="button" class="remove" aria-label="移除">×</button>`;
      chip.querySelector(".remove").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTag(tag);
      });
      box.appendChild(chip);
    });
  }

  function toggleTag(tag) {
    const i = state.selectedTags.indexOf(tag);
    if (i >= 0) state.selectedTags.splice(i, 1);
    else state.selectedTags.push(tag);
    renderSelectedTags();
  }

  function pillClass(index) {
    return `pill pill-${index % 4}`;
  }

  function switchView(name) {
    if (typeof TimiViews !== "undefined") TimiViews.switchView(name);
    else {
      $("view-table")?.classList.toggle("hidden", name !== "table");
      $("view-write")?.classList.toggle("hidden", name !== "write");
    }
    document.querySelector(".main-area")?.classList.toggle("write-mode", name === "write");
  }

  function updateMoodBadge() {
    const badge = $("write-mood-badge");
    if (!badge) return;
    const mood = getMood();
    if (mood) {
      badge.textContent = mood;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function syncPageTitleFromField() {
    const title = ($("field-title")?.value || "").trim();
    const h = document.querySelector(".page-title");
    if (h) h.textContent = title || "私密日记本";
  }

  function getFilterParams() {
    const params = new URLSearchParams();
    const tag = $("filter-tag")?.value;
    const mood = $("filter-mood")?.value;
    const q = $("filter-keyword")?.value?.trim();
    if (tag) params.set("tag", tag);
    if (mood) params.set("mood", mood);
    if (q) params.set("q", q);
    return params;
  }

  function setPageActive(id) {
    document.querySelectorAll(".page-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === id);
    });
    document.querySelectorAll(".db-row").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === id);
    });
  }

  function pageTitle(item) {
    const t = (item.title || "").trim();
    if (t) return t;
    const preview = (item.content || "").replace(/\n/g, " ").trim().slice(0, 16);
    return preview || item.date || "无标题";
  }

  async function openEntry(id) {
    const detail = await TimiApi.get(`/api/diaries/${id}`);
    fillEditor(detail.data);
    setPageActive(id);
    switchView("write");
    syncPageTitleFromField();
  }

  async function loadFolders() {
    try {
      const res = await TimiApi.get("/api/folders");
      state.folders = res.data || [];
    } catch (_) {
      state.folders = [];
    }
  }

  async function loadSidebarPages() {
    await loadFolders();
    const params = getFilterParams();
    const qs = params.toString();
    const res = await TimiApi.get(`/api/diaries/all${qs ? `?${qs}` : ""}`);
    const items = res.data || [];
    state.allItemsCache = items;
    state.tagCounts = computeTagCounts(items);
    renderSidebarPages(items);
    renderSidebarTags();
    if (typeof TimiViews !== "undefined") TimiViews.refresh(items);
    return items;
  }

  function computeTagCounts(items) {
    const counts = {};
    (items || []).forEach((item) => {
      (item.tags || []).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }

  function getActiveTagFilter() {
    return ($("filter-tag")?.value || "").trim();
  }

  function setTagFilter(tag) {
    const sel = $("filter-tag");
    if (sel) sel.value = tag || "";
    updateTagFilterUI();
  }

  function updateTagFilterUI() {
    const active = getActiveTagFilter();
    document.querySelectorAll("#sidebar-tags .nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tag === active);
    });
    const clearBtn = $("btn-clear-tag-filter");
    if (clearBtn) clearBtn.classList.toggle("hidden", !active);
    const chip = $("active-filter-chip");
    if (chip) {
      if (active) {
        chip.classList.remove("hidden");
        chip.textContent = `筛选：${active}`;
      } else {
        chip.classList.add("hidden");
      }
    }
  }

  function toggleTagFilter(tag) {
    const cur = getActiveTagFilter();
    setTagFilter(cur === tag ? "" : tag);
    if (getActiveTagFilter()) switchView("table");
    refreshAll();
  }

  function makePageRow(item, indent = 0) {
    const row = document.createElement("div");
    row.className = "page-item";
    row.dataset.id = item.id;
    row.style.paddingLeft = `${8 + indent * 14}px`;
    if (item.id === state.currentId) row.classList.add("active");
    const emoji = item.page_icon || item.icon || item.mood || "📄";
    row.innerHTML = `
      <span class="page-chevron">›</span>
      <span class="page-emoji">${emoji}</span>
      <span class="page-label">${escapeHtml(pageTitle(item))}</span>
      <div class="page-actions">
        <button type="button" class="page-act-btn page-sub" title="子页面">+</button>
        <button type="button" class="page-act-btn page-more" title="删除">⋯</button>
      </div>
    `;
    row.addEventListener("click", (e) => {
      if (e.target.closest(".page-act-btn")) return;
      openEntry(item.id);
    });
    row.querySelector(".page-sub")?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.createParentId = item.id;
      state.createFolderId = item.folder_id || "";
      clearEditor();
      switchView("write");
    });
    row.querySelector(".page-more")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`确定删除「${pageTitle(item)}」及其子页面？`)) return;
      await TimiApi.del(`/api/diaries/${item.id}`);
      if (state.currentId === item.id) clearEditor();
      await refreshAll();
    });
    return row;
  }

  function renderPageTree(items, parentId, container, indent) {
    items
      .filter((i) => (i.parent_id || "") === parentId)
      .forEach((item) => {
        container.appendChild(makePageRow(item, indent));
        renderPageTree(items, item.id, container, indent + 1);
      });
  }

  function renderSidebarPages(items) {
    const box = $("sidebar-pages");
    if (!box) return;
    box.innerHTML = "";

    state.folders.forEach((folder) => {
      const group = document.createElement("div");
      group.className = "page-group";
      const head = document.createElement("div");
      head.className = "page-group-head";
      head.innerHTML = `
        <span class="chevron">▾</span>
        <span class="group-icon">${folder.icon || "📁"}</span>
        <span class="group-title">${escapeHtml(folder.name)}</span>
      `;
      head.addEventListener("click", () => group.classList.toggle("collapsed"));
      const children = document.createElement("div");
      children.className = "page-group-children";
      const inFolder = items.filter((i) => i.folder_id === folder.id && !(i.parent_id));
      inFolder.forEach((item) => {
        children.appendChild(makePageRow(item, 0));
        renderPageTree(items, item.id, children, 1);
      });
      group.appendChild(head);
      group.appendChild(children);
      box.appendChild(group);
    });

    const rootItems = items.filter((i) => !i.folder_id && !i.parent_id);
    if (!rootItems.length && !state.folders.length) {
      box.innerHTML = '<div class="pages-empty">暂无日记，点击 + 新建</div>';
      return;
    }

    const groups = new Map();
    rootItems.forEach((item) => {
      const month = (item.date || "未知").slice(0, 7);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(item);
    });
    const sortedMonths = [...groups.keys()].sort().reverse();
    const todayMonth = todayStr().slice(0, 7);

    sortedMonths.forEach((month) => {
      const group = document.createElement("div");
      group.className = "page-group";
      if (month !== todayMonth) group.classList.add("collapsed");
      const head = document.createElement("div");
      head.className = "page-group-head";
      head.innerHTML = `
        <span class="chevron">▾</span>
        <span class="group-icon">📅</span>
        <span class="group-title">${month}</span>
        <span class="group-count">${groups.get(month).length}</span>
      `;
      head.addEventListener("click", () => group.classList.toggle("collapsed"));
      const children = document.createElement("div");
      children.className = "page-group-children";
      groups.get(month).forEach((item) => {
        children.appendChild(makePageRow(item, 0));
        renderPageTree(items, item.id, children, 1);
      });
      group.appendChild(head);
      group.appendChild(children);
      box.appendChild(group);
    });
  }

  async function refreshAll() {
    await loadStats();
    const items = await loadSidebarPages();
    await loadList(state.page);
    return items;
  }

  function renderSidebarTags() {
    const box = document.getElementById("sidebar-tags");
    if (!box) return;
    box.innerHTML = "";
    const catalog = state.tagsCatalog || [];
    const usedTags = Object.keys(state.tagCounts || {}).sort(
      (a, b) => (state.tagCounts[b] || 0) - (state.tagCounts[a] || 0)
    );
    const displayTags = [...new Set([...usedTags, ...catalog])];

    if (!displayTags.length) {
      box.innerHTML =
        '<p class="sidebar-tag-hint" style="padding-top:4px">暂无标签。在「页面设置」里为日记添加标签后会出现在这里。</p>';
      updateTagFilterUI();
      return;
    }

    displayTags.forEach((tag) => {
      const n = state.tagCounts[tag] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item";
      btn.dataset.tag = tag;
      if (getActiveTagFilter() === tag) btn.classList.add("active");
      btn.innerHTML = `<span><span class="nav-icon">🏷</span> ${escapeHtml(tag)}</span><span class="tag-count">${n}</span>`;
      btn.addEventListener("click", () => toggleTagFilter(tag));
      box.appendChild(btn);
    });
    updateTagFilterUI();
  }

  function clearEditor() {
    state.currentId = null;
    state.createParentId = "";
    state.createFolderId = "";
    $("field-date").value = todayStr();
    $("field-title").value = "";
    if (typeof TimiBlocks !== "undefined") TimiBlocks.clear();
    else if ($("field-content")) $("field-content").value = "";
    $("field-mood-custom").value = "";
    state.selectedTags = [];
    state.selectedMood = "";
    document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
    renderSelectedTags();
    updateCurrentWordCount();
    setPageActive(null);
    syncPageTitleFromField();
    updateMoodBadge();
  }

  function fillEditor(entry) {
    state.currentId = entry.id;
    setPageActive(entry.id);
    $("field-date").value = entry.date;
    $("field-title").value = entry.title || "";
    syncPageTitleFromField();
    updateMoodBadge();
    if (typeof TimiBlocks !== "undefined") {
      TimiBlocks.setBlocks(entry.blocks || [{ type: "text", content: entry.content || "", checked: false }]);
    } else if ($("field-content")) {
      $("field-content").value = entry.content || "";
    }
    state.selectedTags = [...(entry.tags || [])];
    state.selectedMood = entry.mood || "";
    $("field-mood-custom").value = "";
    document.querySelectorAll(".mood-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mood === entry.mood);
    });
    renderSelectedTags();
    updateCurrentWordCount();
  }

  async function loadList(page = 1) {
    const params = getFilterParams();
    params.set("page", String(page));
    params.set("per_page", String(state.perPage));

    const res = await TimiApi.get(`/api/diaries?${params}`);
    const data = res.data;
    state.page = data.page;
    state.pages = data.pages;
    renderList(data.items);
    renderPagination();
    await loadSidebarPages();
  }

  function renderList(items) {
    const tbody = $("diary-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!items.length) {
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="5">还没有日记，点击右上角「新建」写下第一篇</td></tr>';
      return;
    }
    items.forEach((item) => {
      const tr = document.createElement("tr");
      tr.className = "db-row";
      tr.dataset.id = item.id;
      if (item.id === state.currentId) tr.classList.add("active");
      const preview = (item.content || "").replace(/\n/g, " ").trim().slice(0, 60);
      const title = item.title || "无标题";
      const tagsHtml = (item.tags || [])
        .map((t, i) => {
          const idx = state.tagsCatalog.indexOf(t);
          return `<span class="${pillClass(idx >= 0 ? idx : i)}">${t}</span>`;
        })
        .join("") || '<span class="cell-empty">—</span>';
      const dateFmt = (item.date || "").replace(/-/g, "/");
      tr.innerHTML = `
        <td class="col-title">
          <div class="cell-title">${escapeHtml(title)}</div>
          <div class="cell-preview">${escapeHtml(preview || "（空）")}</div>
        </td>
        <td class="col-mood cell-mood">${item.mood || "—"}</td>
        <td class="col-tags">${tagsHtml}</td>
        <td class="col-date cell-date">${dateFmt}</td>
        <td class="col-words cell-words">${item.word_count ?? 0}</td>
      `;
      tr.addEventListener("click", () => openEntry(item.id));
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function renderPagination() {
    const box = $("pagination");
    box.innerHTML = "";
    if (state.pages <= 1) return;

    const prev = document.createElement("button");
    prev.className = "page-btn";
    prev.textContent = "上一页";
    prev.disabled = state.page <= 1;
    prev.addEventListener("click", () => loadList(state.page - 1));
    box.appendChild(prev);

    for (let i = 1; i <= state.pages; i++) {
      if (state.pages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== state.pages) {
        if (i === 2 || i === state.pages - 1) {
          const span = document.createElement("span");
          span.textContent = "…";
          box.appendChild(span);
        }
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "page-btn" + (i === state.page ? " active" : "");
      btn.textContent = String(i);
      btn.addEventListener("click", () => loadList(i));
      box.appendChild(btn);
    }

    const next = document.createElement("button");
    next.className = "page-btn";
    next.textContent = "下一页";
    next.disabled = state.page >= state.pages;
    next.addEventListener("click", () => loadList(state.page + 1));
    box.appendChild(next);
  }

  async function save() {
    const editor = getEditorPayload();
    const isUpdate = !!state.currentId;
    const payload = {
      date: $("field-date").value,
      title: $("field-title").value,
      content: editor.content,
      blocks: editor.blocks,
      mood: getMood(),
      tags: state.selectedTags,
      icon: getMood() || "",
    };
    if (!isUpdate) {
      payload.parent_id = state.createParentId || "";
      payload.folder_id = state.createFolderId || "";
    }
    let res;
    if (isUpdate) {
      res = await TimiApi.put(`/api/diaries/${state.currentId}`, payload);
      updateStats(res.stats);
      fillEditor(res.data);
      await refreshAll();
    } else {
      res = await TimiApi.post("/api/diaries", payload);
      updateStats(res.stats);
      state.createParentId = "";
      state.createFolderId = "";
      fillEditor(res.data);
      await refreshAll();
      switchView("write");
      const titleEl = document.querySelector(".page-title");
      if (titleEl) titleEl.textContent = pageTitle(res.data);
    }
    return { res, isUpdate };
  }

  async function remove() {
    if (!state.currentId) return null;
    const res = await TimiApi.del(`/api/diaries/${state.currentId}`);
    clearEditor();
    if (res.stats) updateStats(res.stats);
    await refreshAll();
    return res;
  }

  async function addTagToCatalog() {
    const tag = $("field-tag-input").value.trim();
    if (!tag) return;
    const res = await TimiApi.post("/api/tags", { tag });
    state.tagsCatalog = res.data;
    renderTagCatalog();
    if (!state.selectedTags.includes(tag)) toggleTag(tag);
    renderSidebarTags();
    $("field-tag-input").value = "";
  }

  function buildFilterMoods() {
    const sel = $("filter-mood");
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部心情</option>';
    state.moods.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
    sel.value = cur;
  }

  return {
    state,
    todayStr,
    updateCurrentWordCount,
    loadStats,
    renderMoodPicker,
    renderTagCatalog,
    renderSidebarTags,
    buildFilterMoods,
    clearEditor,
    loadList,
    loadSidebarPages,
    loadFolders,
    refreshAll,
    save,
    remove,
    addTagToCatalog,
    toggleTag,
    getMood,
    switchView,
    fillEditor,
    openEntry,
    updateMoodBadge,
    syncPageTitleFromField,
    setTagFilter,
    updateTagFilterUI,
    toggleTagFilter,
  };
})();
