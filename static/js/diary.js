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
    const n = countWords($("field-content").value);
    $("stat-current").textContent = n;
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

  function clearEditor() {
    state.currentId = null;
    $("field-date").value = todayStr();
    $("field-title").value = "";
    $("field-content").value = "";
    $("field-mood-custom").value = "";
    state.selectedTags = [];
    state.selectedMood = "";
    document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("active"));
    renderSelectedTags();
    updateCurrentWordCount();
    document.querySelectorAll(".diary-item").forEach((el) => el.classList.remove("active"));
  }

  function fillEditor(entry) {
    state.currentId = entry.id;
    $("field-date").value = entry.date;
    $("field-title").value = entry.title || "";
    $("field-content").value = entry.content || "";
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
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(state.perPage),
    });
    const tag = $("filter-tag").value;
    const mood = $("filter-mood").value;
    const q = $("filter-keyword").value.trim();
    if (tag) params.set("tag", tag);
    if (mood) params.set("mood", mood);
    if (q) params.set("q", q);

    const res = await TimiApi.get(`/api/diaries?${params}`);
    const data = res.data;
    state.page = data.page;
    state.pages = data.pages;
    renderList(data.items);
    renderPagination();
  }

  function renderList(items) {
    const ul = $("diary-list");
    ul.innerHTML = "";
    if (!items.length) {
      ul.innerHTML = '<li class="empty-hint">还没有日记，在左侧写下第一篇吧</li>';
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "diary-item";
      if (item.id === state.currentId) li.classList.add("active");
      const preview = (item.content || "").replace(/\n/g, " ").slice(0, 80);
      const tagsHtml = (item.tags || [])
        .map((t) => `<span class="badge">${t}</span>`)
        .join("");
      li.innerHTML = `
        <div class="meta">
          <span>${item.date} ${item.mood || ""}</span>
          <span>${item.word_count} 字</span>
        </div>
        <div class="title">${item.title || "无标题"}</div>
        <div class="preview">${preview || "（空）"}</div>
        <div class="badges">${tagsHtml}</div>
      `;
      li.addEventListener("click", async () => {
        document.querySelectorAll(".diary-item").forEach((el) => el.classList.remove("active"));
        li.classList.add("active");
        const detail = await TimiApi.get(`/api/diaries/${item.id}`);
        fillEditor(detail.data);
      });
      ul.appendChild(li);
    });
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
    const payload = {
      date: $("field-date").value,
      title: $("field-title").value,
      content: $("field-content").value,
      mood: getMood(),
      tags: state.selectedTags,
    };
    let res;
    if (state.currentId) {
      res = await TimiApi.put(`/api/diaries/${state.currentId}`, payload);
    } else {
      res = await TimiApi.post("/api/diaries", payload);
      state.currentId = res.data.id;
    }
    updateStats(res.stats);
    await loadList(state.page);
    return res;
  }

  async function remove() {
    if (!state.currentId) return null;
    const res = await TimiApi.del(`/api/diaries/${state.currentId}`);
    clearEditor();
    if (res.stats) updateStats(res.stats);
    return res;
  }

  async function addTagToCatalog() {
    const tag = $("field-tag-input").value.trim();
    if (!tag) return;
    const res = await TimiApi.post("/api/tags", { tag });
    state.tagsCatalog = res.data;
    renderTagCatalog();
    if (!state.selectedTags.includes(tag)) toggleTag(tag);
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
    buildFilterMoods,
    clearEditor,
    loadList,
    save,
    remove,
    addTagToCatalog,
    toggleTag,
    getMood,
  };
})();
