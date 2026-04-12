<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Btoan AI Code</title>

  <link rel="icon" href="/favicon.ico">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link rel="stylesheet" href="./code.css">


  <script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js"></script>
</head>
<body>
  <div class="code-app">
    <header class="code-topbar">
      <div class="top-left">
        <a href="/index.php" class="top-btn">← Về chat</a>
        <div class="brand">Btoan AI Code</div>
      </div>

      <div class="top-right">
        <button id="newFileBtn" class="top-btn">New File</button>
        <button id="newFolderBtn" class="top-btn">New Folder</button>
        <label class="top-btn" for="uploadWorkspaceFile">Upload File</label>
        <input id="uploadWorkspaceFile" type="file" hidden>

        <label class="top-btn" for="uploadWorkspaceFolder">Upload Folder</label>
        <input id="uploadWorkspaceFolder" type="file" webkitdirectory directory multiple hidden>
        <a href="/ai/api/workspace/download.php" class="top-btn">Download Project</a>
        <button id="saveFileBtn" class="top-btn primary">Save</button>
      </div>
    </header>

    

    <div class="code-body">
      <aside class="explorer-panel">
        <div class="panel-header">
          <span>EXPLORER</span>
          <button id="reloadTreeBtn">↻</button>
        </div>

        <input id="globalSearchInput" class="search-input" placeholder="Tìm file hoặc nội dung...">
        <button id="globalSearchBtn" class="search-btn">Search</button>

        <div id="fileTree" class="file-tree"></div>
      </aside>

      <main class="editor-panel">
        <div id="tabsBar" class="tabs-bar"></div>
        <div id="editor" class="editor-host"></div>
      </main>

      <aside class="assistant-panel">
        <div class="panel-header">
          <span>AI AGENT</span>
        </div>

        <div class="small-label">File đang mở</div>
        <div id="currentFileLabel" class="current-file-label">Chưa chọn file</div>

        <div id="agentChatHistory" class="agent-chat-history"></div>

        <textarea id="agentInput" class="ai-prompt" rows="6"
          placeholder="Hỏi AI, yêu cầu sửa code, tạo file, tạo folder..."></textarea>

        <button id="agentSendBtn" class="top-btn primary w-100">Gửi cho AI</button>
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

  <script src="./workspace.js"></script>
</body>
</html>