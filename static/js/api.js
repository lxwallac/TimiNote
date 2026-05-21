/**
 * API 请求封装：统一 JSON 与文件下载
 */
const TimiApi = (() => {
  const base = "";

  async function request(url, options = {}) {
    const opts = {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    };
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(base + url, opts);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "请求失败");
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }
    if (!res.ok) throw new Error("请求失败");
    return res;
  }

  return {
    get: (url) => request(url),
    post: (url, body) => request(url, { method: "POST", body }),
    put: (url, body) => request(url, { method: "PUT", body }),
    del: (url) => request(url, { method: "DELETE" }),

    /** 触发浏览器下载 TXT */
    download: (url, filename) => {
      const a = document.createElement("a");
      a.href = base + url;
      a.download = filename || "export.txt";
      a.click();
    },
  };
})();
