/**
 * Notion 风格块编辑器：/ 菜单、拖拽排序、折叠/代码/图片块
 */
const TimiBlocks = (() => {
  const BLOCK_DEFS = [
    { type: "text", icon: "Aa", label: "文本", placeholder: "输入文字，或输入 / 插入块" },
    { type: "todo", icon: "☑", label: "待办列表", placeholder: "待办事项" },
    { type: "h1", icon: "H1", label: "主标题", placeholder: "主标题" },
    { type: "h2", icon: "H2", label: "大标题", placeholder: "大标题" },
    { type: "h3", icon: "H3", label: "中标题", placeholder: "中标题" },
    { type: "h4", icon: "H4", label: "小标题", placeholder: "小标题" },
    { type: "bullet", icon: "•", label: "列表", placeholder: "列表项" },
    { type: "numbered", icon: "1.", label: "数字列表", placeholder: "列表项" },
    { type: "toggle", icon: "▶", label: "折叠列表", placeholder: "折叠标题" },
    { type: "quote", icon: "❝", label: "引述文字", placeholder: "引用内容" },
    { type: "callout", icon: "💡", label: "着重文字", placeholder: "着重内容" },
    { type: "code", icon: "</>", label: "代码", placeholder: "代码内容" },
    { type: "image", icon: "🖼", label: "图片", placeholder: "" },
    { type: "divider", icon: "—", label: "分割线", placeholder: "" },
  ];

  let listEl, menuEl, onChangeCb = null;
  let slashTarget = null;
  let dragSrc = null;

  const $ = (id) => document.getElementById(id);

  function uid() {
    return "b" + Math.random().toString(36).slice(2, 9);
  }

  function defFor(type) {
    return BLOCK_DEFS.find((d) => d.type === type) || BLOCK_DEFS[0];
  }

  function init() {
    listEl = $("block-list");
    menuEl = $("block-slash-menu");
    if (!listEl || !menuEl) return;
    renderSlashMenu();
    menuEl.addEventListener("mousedown", (e) => e.preventDefault());
    document.addEventListener("click", (e) => {
      if (!menuEl.contains(e.target)) hideSlashMenu();
    });
    document.addEventListener("keydown", onGlobalKeydown);
  }

  function onGlobalKeydown(e) {
    if (menuEl?.classList.contains("hidden")) return;
    const items = [...menuEl.querySelectorAll(".slash-item")];
    if (!items.length) return;
    let idx = items.findIndex((el) => el.classList.contains("active"));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      idx = (idx + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[idx]?.click();
      return;
    } else if (e.key === "Escape") {
      hideSlashMenu();
      return;
    } else return;
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
  }

  function renderSlashMenu(filter = "") {
    if (!menuEl) return;
    const q = filter.toLowerCase();
    const items = BLOCK_DEFS.filter(
      (d) => !q || d.label.toLowerCase().includes(q) || d.type.includes(q)
    );
    menuEl.innerHTML = '<div class="slash-menu-title">基础块列表</div>';
    items.forEach((d, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slash-item" + (i === 0 ? " active" : "");
      btn.dataset.type = d.type;
      btn.innerHTML = `<span class="slash-icon">${d.icon}</span><span>${d.label}</span>`;
      btn.addEventListener("click", () => insertBlockFromSlash(d.type));
      menuEl.appendChild(btn);
    });
    if (!items.length) menuEl.innerHTML += '<div class="slash-empty">无匹配块</div>';
  }

  function showSlashMenu(anchorBlock, filter = "") {
    slashTarget = anchorBlock;
    renderSlashMenu(filter);
    const rect = anchorBlock.getBoundingClientRect();
    menuEl.classList.remove("hidden");
    const left = Math.min(rect.left, window.innerWidth - 300);
    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${rect.top + 28}px`;
  }

  function hideSlashMenu() {
    menuEl?.classList.add("hidden");
    slashTarget = null;
  }

  function insertBlockFromSlash(type) {
    const target = slashTarget;
    hideSlashMenu();
    if (!target) return;
    if (type === "image") {
      pickImage(target);
      return;
    }
    const body = target.querySelector(".block-body");
    if (body) body.textContent = "";
    const el = changeBlockType(target, type);
    getEditable(el)?.focus();
    triggerChange();
  }

  function pickImage(refBlock) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert("图片请小于 2MB（本地存储）");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const el = changeBlockType(refBlock, "image");
        const img = el.querySelector(".block-image");
        if (img) img.src = reader.result;
        el.dataset.src = reader.result;
        triggerChange();
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  function getEditable(blockEl) {
    const t = blockEl.dataset.type;
    if (t === "divider" || t === "image") return null;
    return blockEl.querySelector(".block-body");
  }

  function bindDrag(wrap) {
    const handle = wrap.querySelector(".block-drag");
    if (!handle) return;
    handle.draggable = true;
    handle.addEventListener("dragstart", (e) => {
      dragSrc = wrap;
      wrap.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    handle.addEventListener("dragend", () => {
      wrap.classList.remove("dragging");
      dragSrc = null;
      listEl.querySelectorAll(".block").forEach((b) => b.classList.remove("drag-over"));
    });
    wrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (dragSrc && dragSrc !== wrap) wrap.classList.add("drag-over");
    });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("drag-over"));
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      wrap.classList.remove("drag-over");
      if (dragSrc && dragSrc !== wrap) {
        wrap.before(dragSrc);
        triggerChange();
      }
    });
  }

  function createBlockEl(block = { type: "text", content: "", checked: false, children: [] }) {
    const def = defFor(block.type);
    const wrap = document.createElement("div");
    wrap.className = "block";
    wrap.dataset.type = block.type;
    wrap.dataset.id = block.id || uid();

    const handleHtml = '<span class="block-drag" title="拖动排序">⋮⋮</span>';

    if (block.type === "divider") {
      wrap.innerHTML = `${handleHtml}<div class="block-divider-line"></div>`;
      bindDrag(wrap);
      return wrap;
    }

    if (block.type === "image") {
      const src = block.content || "";
      wrap.innerHTML = `${handleHtml}<div class="block-image-wrap"><img class="block-image" alt=""></div>`;
      const img = wrap.querySelector(".block-image");
      if (src) img.src = src;
      wrap.dataset.src = src;
      bindDrag(wrap);
      return wrap;
    }

    if (block.type === "toggle") {
      wrap.classList.add("block-toggle");
      wrap.innerHTML = `
        ${handleHtml}
        <button type="button" class="toggle-btn">${block.collapsed ? "▸" : "▾"}</button>
        <div class="block-body" contenteditable="true" data-placeholder="${def.placeholder}"></div>
        <div class="block-toggle-children"></div>
      `;
      wrap.querySelector(".block-body").textContent = block.content || "";
      const childBox = wrap.querySelector(".block-toggle-children");
      (block.children || []).forEach((ch) => childBox.appendChild(createBlockEl(ch)));
      wrap.querySelector(".toggle-btn").addEventListener("click", () => {
        wrap.classList.toggle("collapsed");
        const btn = wrap.querySelector(".toggle-btn");
        btn.textContent = wrap.classList.contains("collapsed") ? "▸" : "▾";
      });
      if (block.collapsed) wrap.classList.add("collapsed");
    } else if (block.type === "todo") {
      wrap.classList.add("block-todo");
      wrap.innerHTML = `
        ${handleHtml}
        <label class="todo-check-wrap"><input type="checkbox" class="todo-check" ${block.checked ? "checked" : ""}></label>
        <div class="block-body" contenteditable="true" data-placeholder="${def.placeholder}"></div>
      `;
      const body = wrap.querySelector(".block-body");
      body.textContent = block.content || "";
      const check = wrap.querySelector(".todo-check");
      check.addEventListener("change", () => {
        body.classList.toggle("done", check.checked);
        triggerChange();
      });
      if (block.checked) body.classList.add("done");
    } else if (block.type === "code") {
      wrap.classList.add("block-code");
      wrap.innerHTML = `${handleHtml}<pre class="block-body" contenteditable="true" data-placeholder="${def.placeholder}"></pre>`;
      wrap.querySelector(".block-body").textContent = block.content || "";
    } else {
      wrap.classList.add(`block-${block.type}`);
      wrap.innerHTML = `${handleHtml}<div class="block-body" contenteditable="true" data-placeholder="${def.placeholder}"></div>`;
      wrap.querySelector(".block-body").textContent = block.content || "";
    }

    const editable = getEditable(wrap);
    if (editable) {
      editable.addEventListener("input", onBlockInput);
      editable.addEventListener("keydown", onBlockKeydown);
      editable.addEventListener("focus", () => {
        listEl.querySelectorAll(".block").forEach((b) => b.classList.remove("focused"));
        wrap.classList.add("focused");
      });
    }
    bindDrag(wrap);
    return wrap;
  }

  function changeBlockType(blockEl, type) {
    const data = blockToData(blockEl);
    data.type = type;
    if (type === "toggle" && !data.children?.length) {
      data.children = [{ type: "text", content: "", checked: false, children: [] }];
    }
    const newEl = createBlockEl(data);
    newEl.dataset.id = blockEl.dataset.id;
    blockEl.replaceWith(newEl);
    return newEl;
  }

  function blockToData(blockEl) {
    const type = blockEl.dataset.type;
    if (type === "divider") return { type, content: "", checked: false, children: [] };
    if (type === "image") {
      return { type, content: blockEl.dataset.src || blockEl.querySelector(".block-image")?.src || "", children: [] };
    }
    const body = blockEl.querySelector(":scope > .block-body");
    const data = {
      type,
      content: body?.textContent || "",
      checked: blockEl.querySelector(".todo-check")?.checked || false,
      collapsed: blockEl.classList.contains("collapsed"),
      children: [],
    };
    if (type === "toggle") {
      const childBox = blockEl.querySelector(".block-toggle-children");
      childBox?.querySelectorAll(":scope > .block").forEach((ch) => {
        data.children.push(blockToData(ch));
      });
    }
    return data;
  }

  function onBlockInput(e) {
    const editable = e.target;
    const block = editable.closest(".block");
    const text = editable.textContent || "";
    if (text === "/") {
      showSlashMenu(block, "");
      return;
    }
    if (text.startsWith("/") && text.length > 1) {
      showSlashMenu(block, text.slice(1));
      return;
    }
    hideSlashMenu();
    triggerChange();
  }

  function onBlockKeydown(e) {
    const editable = e.target;
    const block = editable.closest(".block");
    const text = editable.textContent || "";
    const multiLine = block.dataset.type === "code" || e.shiftKey;

    if (e.key === "Enter" && !multiLine) {
      const t = block.dataset.type;
      if (["text", "quote", "callout", "bullet", "numbered", "h1", "h2", "h3", "h4", "todo"].includes(t)) {
        e.preventDefault();
        insertAfter(block, { type: "text", content: "", children: [] });
      }
    }
    if (e.key === "Backspace" && text === "" && listEl.querySelectorAll(":scope > .block").length > 1) {
      const isRoot = block.parentElement === listEl;
      if (isRoot) {
        e.preventDefault();
        const prev = block.previousElementSibling;
        block.remove();
        getEditable(prev)?.focus();
        triggerChange();
      }
    }
  }

  function insertAfter(refBlock, blockData) {
    const el = createBlockEl(blockData);
    refBlock.after(el);
    getEditable(el)?.focus();
    triggerChange();
    return el;
  }

  function insertAtEnd(blockData) {
    const el = createBlockEl(blockData);
    listEl.appendChild(el);
    getEditable(el)?.focus();
    triggerChange();
    return el;
  }

  function collectFromContainer(container) {
    const blocks = [];
    container.querySelectorAll(":scope > .block").forEach((el) => blocks.push(blockToData(el)));
    return blocks;
  }

  function collectBlocks() {
    const blocks = collectFromContainer(listEl);
    return blocks.length ? blocks : [{ type: "text", content: "", checked: false, children: [] }];
  }

  function getPlainText() {
    function flat(blks, depth = 0) {
      const lines = [];
      blks.forEach((b) => {
        const c = b.content || "";
        if (b.type === "divider") lines.push("---");
        else if (c) lines.push(c);
        if (b.children?.length) lines.push(...flat(b.children, depth + 1));
      });
      return lines;
    }
    return flat(collectBlocks()).join("\n");
  }

  function countWords() {
    return getPlainText().replace(/\s/g, "").length;
  }

  function setBlocks(blocks) {
    listEl.innerHTML = "";
    const data = blocks?.length ? blocks : [{ type: "text", content: "", checked: false, children: [] }];
    data.forEach((b) => listEl.appendChild(createBlockEl(b)));
    hideSlashMenu();
    triggerChange();
  }

  function clear() {
    setBlocks([{ type: "text", content: "", checked: false, children: [] }]);
  }

  function onChange(fn) {
    onChangeCb = fn;
  }

  function triggerChange() {
    onChangeCb?.();
  }

  function addBlockToolbar() {
    const bar = $("block-add-bar");
    if (!bar) return;
    bar.innerHTML = "";
    ["text", "h2", "todo", "bullet", "toggle", "quote", "code", "divider"].forEach((type) => {
      const d = defFor(type);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "block-add-chip";
      btn.textContent = `${d.icon} ${d.label}`;
      btn.addEventListener("click", () => {
        const last = listEl.querySelector(":scope > .block:last-child");
        if (last) insertAfter(last, { type, content: "", children: type === "toggle" ? [{ type: "text", content: "", children: [] }] : [] });
        else insertAtEnd({ type, content: "", children: [] });
      });
      bar.appendChild(btn);
    });
  }

  return {
    init,
    setBlocks,
    clear,
    collectBlocks,
    getPlainText,
    countWords,
    onChange,
    addBlockToolbar,
    insertAtEnd,
  };
})();
