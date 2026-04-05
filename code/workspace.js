let editor;
let openTabs = [];
let currentFile = null;
const models = {};

function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const userId = localStorage.getItem("user_id");

  if (userId) {
    headers.set("X-User-Id", userId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  return fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
    signal: controller.signal
  })
    .then(async (res) => {
      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        throw new Error(raw.slice(0, 800));
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || "API error");
      }

      return data;
    })
    .finally(() => clearTimeout(timeout));
}

function getLanguageFromPath(path) {
  const ext = path.split(".").pop().toLowerCase();
  const map = {
    js: "javascript",
    php: "php",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    txt: "plaintext",
    sql: "sql",
    xml: "xml"
  };
  return map[ext] || "plaintext";
}

function fileName(path) {
  return path.split("/").pop();
}

function renderTabs() {
  const tabsBar = document.getElementById("tabsBar");
  tabsBar.innerHTML = "";

  openTabs.forEach((path) => {
    const tab = document.createElement("div");
    tab.className = "tab-item" + (path === currentFile ? " active" : "");
    tab.innerHTML = `
      <span>${fileName(path)}</span>
      <span class="tab-close">×</span>
    `;

    tab.onclick = (e) => {
      if (e.target.classList.contains("tab-close")) {
        closeTab(path);
        return;
      }
      switchToTab(path);
    };

    tabsBar.appendChild(tab);
  });
}

function closeTab(path) {
  openTabs = openTabs.filter((p) => p !== path);

  if (currentFile === path) {
    currentFile = openTabs.length ? openTabs[openTabs.length - 1] : null;
    if (currentFile) {
      editor.setModel(models[currentFile]);
    } else {
      editor.setModel(null);
    }
  }

  renderTabs();
  updateCurrentFileLabel();
  highlightActiveFile();
}

function switchToTab(path) {
  currentFile = path;
  editor.setModel(models[path]);
  renderTabs();
  updateCurrentFileLabel();
  highlightActiveFile();
}

function updateCurrentFileLabel() {
  document.getElementById("currentFileLabel").textContent = currentFile || "Chưa chọn file";
}

function highlightActiveFile() {
  document.querySelectorAll(".tree-item.file").forEach((el) => {
    el.classList.toggle("active", el.dataset.path === currentFile);
  });
}

function renderTree(nodes, container, depth = 0) {
  nodes.forEach((node) => {
    const div = document.createElement("div");
    div.className = `tree-item ${node.type} tree-indent-${Math.min(depth, 5)}`;
    div.dataset.path = node.path;

    const icon = node.type === "dir" ? "📁" : "📄";
    div.textContent = `${icon} ${node.name}`;

    if (node.type === "file") {
      div.onclick = () => openFile(node.path);
    }

    container.appendChild(div);

    if (node.type === "dir" && node.children?.length) {
      renderTree(node.children, container, depth + 1);
    }
  });
}

async function loadTree() {
  const data = await api("/ai/api/workspace/list.php");
  const tree = document.getElementById("fileTree");
  tree.innerHTML = "";
  renderTree(data.items, tree);
  highlightActiveFile();
}

async function openFile(path) {
  const data = await api("/ai/api/workspace/read.php?path=" + encodeURIComponent(path));

  if (!models[path]) {
    models[path] = monaco.editor.createModel(
      data.content,
      getLanguageFromPath(path)
    );
  } else {
    models[path].setValue(data.content);
  }

  if (!openTabs.includes(path)) {
    openTabs.push(path);
  }

  currentFile = path;
  editor.setModel(models[path]);
  renderTabs();
  updateCurrentFileLabel();
  highlightActiveFile();
}

async function saveCurrentFile() {
  if (!currentFile) {
    alert("Chưa mở file nào");
    return;
  }

  const content = editor.getValue();

  await api("/ai/api/workspace/save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: currentFile,
      content
    })
  });

  alert("Đã lưu: " + currentFile);
}

async function searchWorkspace() {
  const q = document.getElementById("globalSearchInput").value.trim();
  if (!q) return;

  const data = await api("/ai/api/workspace/search.php?q=" + encodeURIComponent(q));
  const box = document.getElementById("searchResults");
  box.innerHTML = "";

  if (!data.items.length) {
    box.innerHTML = `<div class="text-secondary small">Không có kết quả</div>`;
    return;
  }

  data.items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "search-item";
    div.innerHTML = `
      <div class="path">${item.path}</div>
      <div class="snippet">${item.snippet}</div>
    `;
    div.onclick = async () => {
      await openFile(item.path);
    };
    box.appendChild(div);
  });
}

async function aiEditCurrentFile() {
  if (!currentFile) {
    alert("Chưa mở file nào");
    return;
  }

  const instruction = document.getElementById("aiPrompt").value.trim();
  if (!instruction) {
    alert("Nhập yêu cầu cho AI trước");
    return;
  }

  const btn = document.getElementById("aiEditBtn");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `Đang sửa...`;

  try {
    const data = await api("/ai/api/workspace/ai_edit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: currentFile,
        instruction
      })
    });

    if (!models[currentFile]) {
      await openFile(currentFile);
    }

    models[currentFile].setValue(data.content);
    alert("AI đã sửa file trong editor. Nếu ổn thì bấm Save.");
  } catch (e) {
    alert("AI edit lỗi: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

function initMonaco() {
  require(["vs/editor/editor.main"], function () {
    monaco.editor.defineTheme("btoan-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e"
      }
    });

    editor = monaco.editor.create(document.getElementById("editor"), {
      value: "// Chọn file bên trái để bắt đầu",
      language: "javascript",
      theme: "btoan-dark",
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "JetBrains Mono, Consolas, monospace",
      tabSize: 2
    });

    loadTree();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMonaco();

  const reloadTreeBtn = document.getElementById("reloadTreeBtn");
  const saveFileBtn = document.getElementById("saveFileBtn");
  const globalSearchBtn = document.getElementById("globalSearchBtn");
  const aiEditBtn = document.getElementById("aiEditBtn");
  const globalSearchInput = document.getElementById("globalSearchInput");
  const newFileBtn = document.getElementById("newFileBtn");
  const newFolderBtn = document.getElementById("newFolderBtn");
  const uploadWorkspaceFile = document.getElementById("uploadWorkspaceFile");

  if (reloadTreeBtn) reloadTreeBtn.onclick = loadTree;
  if (saveFileBtn) saveFileBtn.onclick = saveCurrentFile;
  if (globalSearchBtn) globalSearchBtn.onclick = searchWorkspace;
  if (aiEditBtn) aiEditBtn.onclick = aiEditCurrentFile;

  if (globalSearchInput) {
    globalSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchWorkspace();
    });
  }

  if (newFileBtn) {
    newFileBtn.onclick = async () => {
      const path = prompt("Nhập tên file, ví dụ: src/index.html");
      if (!path) return;

      try {
        await api("/ai/api/workspace/create_file.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content: "" })
        });

        await loadTree();
        await openFile(path);
      } catch (e) {
        alert(e.message);
      }
    };
  }

  if (newFolderBtn) {
    newFolderBtn.onclick = async () => {
      const path = prompt("Nhập tên folder, ví dụ: src/components");
      if (!path) return;

      try {
        await api("/ai/api/workspace/create_folder.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path })
        });

        await loadTree();
      } catch (e) {
        alert(e.message);
      }
    };
  }

  if (uploadWorkspaceFile) {
    uploadWorkspaceFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fd = new FormData();
      fd.append("file", file);

      try {
        const userId = localStorage.getItem("user_id");
        const res = await fetch("/ai/api/workspace/upload.php", {
          method: "POST",
          body: fd,
          headers: userId ? { "X-User-Id": userId } : {},
          credentials: "same-origin"
        });

        const raw = await res.text();
        const data = JSON.parse(raw);

        if (!res.ok || data.error) throw new Error(data.error || "Upload lỗi");

        await loadTree();
        await openFile(data.path);
      } catch (err) {
        alert(err.message);
      }

      e.target.value = "";
    });
  }
});