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
        <button id="runBtn" class="top-btn primary">Run / Preview</button>
        <button id="saveFileBtn" class="top-btn primary">Save</button>
      </div>
    </header>

    

    <div class="code-body" id="mainBody">
      <aside class="explorer-panel" id="explorerPanel">
        <div class="panel-header">
          <span>PROJECT</span>
          <button id="reloadTreeBtn" class="sm-btn"><i class="bi bi-arrow-clockwise"></i></button>
        </div>

        <div class="search-container">
          <input id="globalSearchInput" class="search-input" placeholder="Tìm kiếm...">
        </div>

        <div id="fileTree" class="file-tree"></div>
      </aside>

      <main class="editor-panel">
        <div id="tabsBar" class="tabs-bar"></div>
        <div id="editor" class="editor-host"></div>
      </main>

      <aside id="webviewPanel" class="webview-panel">
        <div class="panel-header">
          <span>PREVIEW</span>
          <button id="closeWebviewBtn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">×</button>
        </div>
        <div class="preview-host">
          <iframe id="previewIframe" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"></iframe>
        </div>
      </aside>

      <aside id="assistantPanel" class="assistant-panel">
        <div class="panel-header">
          <span>AI AGENT</span>
        </div>

        <div id="agentChatHistory" class="agent-chat-history"></div>

        <textarea id="agentInput" class="ai-prompt" rows="4"
          placeholder="Yêu cầu sửa code, tạo file..."></textarea>

        <div class="input-wrapper">
          <button id="agentSendBtn" class="top-btn primary w-100">Gửi cho AI</button>
        </div>
      </aside>
    </div>

    <!-- MOBILE NAV -->
    <nav class="mobile-nav">
      <div class="nav-item" onclick="switchMobileTab('explorer')">
        <i class="bi bi-folder2-open"></i>
        <span>Explorer</span>
      </div>
      <div class="nav-item active" onclick="switchMobileTab('editor')">
        <i class="bi bi-code-slash"></i>
        <span>Editor</span>
      </div>
      <div class="nav-item" onclick="switchMobileTab('preview')">
        <i class="bi bi-play-circle"></i>
        <span>Preview</span>
      </div>
      <div class="nav-item" onclick="switchMobileTab('ai')">
        <i class="bi bi-robot"></i>
        <span>AI Agent</span>
      </div>
    </nav>
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