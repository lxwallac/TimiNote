/**
 * 数据库多视图：看板、日历
 */
const TimiViews = (() => {
  const $ = (id) => document.getElementById(id);
  let allItems = [];

  function setItems(items) {
    allItems = items || [];
  }

  function switchView(name) {
    ["table", "write", "board", "calendar"].forEach((v) => {
      const panel = $(`view-${v}`);
      if (panel) panel.classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".view-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === name);
    });
  }

  function renderBoard() {
    const el = $("view-board");
    if (!el) return;
    const columns = new Map();
    const moods = [...new Set(allItems.map((i) => i.mood || "无心情"))];
    moods.forEach((m) => columns.set(m, []));
    allItems.forEach((item) => {
      const col = item.mood || "无心情";
      if (!columns.has(col)) columns.set(col, []);
      columns.get(col).push(item);
    });

    el.innerHTML = '<div class="board-columns"></div>';
    const row = el.querySelector(".board-columns");
    columns.forEach((cards, mood) => {
      const col = document.createElement("div");
      col.className = "board-column";
      col.innerHTML = `<div class="board-col-head">${mood} <span>${cards.length}</span></div>`;
      const body = document.createElement("div");
      body.className = "board-col-body";
      cards.forEach((item) => {
        const card = document.createElement("div");
        card.className = "board-card";
        card.innerHTML = `
          <div class="board-card-title">${escapeHtml(item.title || "无标题")}</div>
          <div class="board-card-meta">${item.date} · ${item.word_count} 字</div>
        `;
        card.addEventListener("click", () => TimiDiary.openEntry(item.id));
        body.appendChild(card);
      });
      col.appendChild(body);
      row.appendChild(col);
    });
  }

  function renderCalendar() {
    const el = $("view-calendar");
    if (!el) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0).getDate();
    const startPad = first.getDay();

    const byDate = {};
    allItems.forEach((item) => {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });

    let html = `<div class="cal-head">${y} 年 ${m + 1} 月</div><div class="cal-grid">`;
    ["日", "一", "二", "三", "四", "五", "六"].forEach((d) => {
      html += `<div class="cal-dow">${d}</div>`;
    });
    for (let i = 0; i < startPad; i++) html += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const items = byDate[ds] || [];
      html += `<div class="cal-cell ${items.length ? "has-entry" : ""}" data-date="${ds}">
        <span class="cal-num">${d}</span>
        ${items.slice(0, 2).map((it) => `<span class="cal-dot" title="${escapeHtml(it.title || "")}">●</span>`).join("")}
      </div>`;
    }
    html += "</div>";
    el.innerHTML = html;
    el.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
      cell.addEventListener("click", () => {
        const date = cell.dataset.date;
        const hits = byDate[date];
        if (hits?.length === 1) TimiDiary.openEntry(hits[0].id);
        else if (hits?.length > 1) {
          TimiDiary.switchView("table");
          document.getElementById("filter-keyword").value = "";
          TimiDiary.loadList(1);
        } else {
          TimiDiary.clearEditor();
          document.getElementById("field-date").value = date;
          TimiDiary.switchView("write");
        }
      });
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function refresh(items) {
    setItems(items);
    if (!$("view-board")?.classList.contains("hidden")) renderBoard();
    if (!$("view-calendar")?.classList.contains("hidden")) renderCalendar();
  }

  return { switchView, renderBoard, renderCalendar, refresh, setItems };
})();
