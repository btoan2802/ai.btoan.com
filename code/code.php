<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Btoan AI Code</title>

  <link rel="icon" href="favicon.ico">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link rel="stylesheet" href="/code.css">

  <script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js"></script>
</head>
<body>
  <div class="code-app">

    <header class="code-topbar">
      <div class="left">
        <a href="/index.php" class="btn btn-sm btn-outline-light">
          <i class="bi bi-arrow-left"></i> Về chat
        </a>

        <div class="brand">
          <i class="bi bi-code-square"></i>
          <span>Btoan AI Code</span>
        </div>
      </div>

      <div class="center">
        <input id="globalSearchInput" class="form-control form-control-sm" placeholder="Tìm file hoặc nội dung...">
        <button id="globalSearchBtn" class="btn btn-sm btn-outline-light">
          <i class="bi bi-search"></i>
        </button>
      </div>

      <div class="right">
        <button id="reloadTreeBtn" class="btn btn-sm btn-outline-light">
          <i class="bi bi-arrow-clockwise"></i> Reload
        </button>
        <button id="saveFileBtn" class="btn btn-sm btn-primary">
          <i class="bi bi-floppy"></i> Save
        </button>
      </div>
    </header>

    <div class="code-body">
      <aside class="explorer-panel">
        <div class="panel-title">EXPLORER</div>
        <div id="fileTree" class="file-tree"></div>
      </aside>

      <main class="editor-panel">
        <div id="tabsBar" class="tabs-bar"></div>
        <div id="editor" class="editor-host"></div>
      </main>

      <aside class="assistant-panel">
        <div class="panel-title">AI ASSISTANT</div>

        <div class="mb-2 small text-secondary">
          File đang mở:
          <div id="currentFileLabel" class="fw-semibold text-light mt-1">Chưa chọn file</div>
        </div>

        <textarea id="aiPrompt" class="form-control mb-2" rows="10"
          placeholder="Ví dụ: sửa giao diện file này cho gọn hơn, giữ nguyên logic"></textarea>

        <button id="aiEditBtn" class="btn btn-warning w-100 mb-3">
          <i class="bi bi-magic"></i> AI sửa file đang mở
        </button>

        <div class="panel-title mt-2">KẾT QUẢ TÌM KIẾM</div>
        <div id="searchResults" class="search-results"></div>
      </aside>
    </div>
  </div>

  <script>
    if (!localStorage.getItem("user_id")) {
      alert("Bạn cần đăng nhập trước");
      location.href = "/index.php";
    }

    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
      }
    });
  </script>

  <script src="/workspace.js"></script>
</body>
</html>