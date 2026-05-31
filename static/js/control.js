/**
 * Timi 控制台前端
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let polling = null;

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  function renderStatus(data) {
    const card = $("status-card");
    card.classList.remove("running", "stopped", "error");

    if (data.running) {
      card.classList.add("running");
      $("status-text").textContent = "日记服务运行中";
      $("btn-start").disabled = true;
      $("btn-stop").disabled = false;
      $("btn-open").disabled = false;
    } else if (data.port_busy) {
      card.classList.add("error");
      $("status-text").textContent = "端口被占用（服务状态未知）";
      $("btn-start").disabled = true;
      $("btn-stop").disabled = false;
      $("btn-open").disabled = true;
    } else {
      card.classList.add("stopped");
      $("status-text").textContent = "日记服务已停止";
      $("btn-start").disabled = false;
      $("btn-stop").disabled = true;
      $("btn-open").disabled = true;
    }

    const link = $("diary-link");
    link.href = data.diary_url;
    link.textContent = data.diary_url;
    $("meta-pid").textContent = data.pid ?? "—";
    $("meta-started").textContent = data.started_at ?? "—";
    $("meta-version").textContent = "UI v" + (data.ui_version || "?");
    $("meta-data").textContent = data.data_dir ?? "—";
  }

  async function fetchStatus() {
    const res = await fetch("/api/status");
    const json = await res.json();
    if (json.ok) renderStatus(json.data);
  }

  async function postAction(url) {
    const res = await fetch(url, { method: "POST" });
    const json = await res.json();
    if (json.data) renderStatus(json.data);
    toast(json.message || (json.ok ? "完成" : "失败"));
    return json.ok;
  }

  $("btn-start").addEventListener("click", async () => {
    $("btn-start").disabled = true;
    await postAction("/api/start");
    await fetchStatus();
  });

  $("btn-stop").addEventListener("click", async () => {
    if (!confirm("确定停止日记服务？正在写的页面将无法保存。")) return;
    $("btn-stop").disabled = true;
    await postAction("/api/stop");
    await fetchStatus();
  });

  $("btn-open").addEventListener("click", () => {
    const url = $("diary-link").href;
    if (url && url !== "#") window.open(url, "_blank");
  });

  fetchStatus();
  polling = setInterval(fetchStatus, 4000);
  window.addEventListener("beforeunload", () => clearInterval(polling));
})();
