<!doctype html>
<html lang="vi">

<head>
  <!-- 1. Meta -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- 2. Title + Icon -->
  <title>Btoan AI</title>
  <base href="/">
  <link rel="icon" href="favicon.ico">

  <!-- 3. CSS Library -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">

  <!-- 4. CSS Local -->
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="login/SignUp_LogIn_Form.css">
  <link rel="stylesheet" href="css/main_style.css?v=<?php echo time(); ?>">

  <!-- 5. Config Script -->
  <script src="js/mathjax_config.js"></script>

  <!-- 6. JS Library -->
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <!-- MediaPipe Core -->
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
</head>

<body>

  <!-- A. LOGIN -->
  <div id="loginBox" style="display:none">
    <!-- Giữ nguyên logic login hiện tại -->
    <div class="container">
      <div class="form-box login" id="loginForm">
        <form onsubmit="event.preventDefault(); login();">
          <div id="loginMsg" style="color:red;"></div>
          <h1>Login</h1>
          <div class="input-box">
            <input id="login_username" type="text" placeholder="Username" required>
            <i class='bx bxs-user'></i>
          </div>
          <div class="input-box">
            <input id="login_password" type="password" placeholder="Password" required>
            <i class='bx bxs-lock-alt'></i>
          </div>
          <button type="submit" class="btn">Login</button>
          <div class="switch-auth">Chưa có tài khoản? <span onclick="showRegisterForm()">Đăng ký</span></div>
          <div class="social-icons">
             <div id="g_id_onload" data-client_id="988870371741-2qt9rtkb37oo71dmtst492j2unvfo569.apps.googleusercontent.com" data-callback="handleGoogleLogin" data-auto_prompt="false"></div>
             <div class="g_id_signin" data-type="standard"></div>
          </div>
        </form>
      </div>
      <!-- Register form... (ẩn bớt để tập trung UI chat) -->
    </div>
  </div>

  <!-- B. CHAT APP -->
  <div id="chatApp" style="display:none">
    <div class="main-app-wrapper">

      <!-- SIDEBAR -->
      <div id="sidebar" class="sidebar">
        <div class="sidebar-header">
           <div class="new-chat-wrapper" onclick="newChat()">
              <i class="bi bi-pencil-square"></i>
              <span>Chat mới</span>
           </div>
        </div>
        
        <div class="sidebar-utils">
          <a href="./code/code.php" class="util-item" title="Btoan AI Code">
            <i class="bi bi-code-slash"></i>
            <span>Btoan AI Code</span>
          </a>
          <div id="toggleHandMode" class="util-item" title="Điều khiển tay">
            <i class="bi bi-hand-index-thumb"></i>
            <span>Điều khiển tay</span>
          </div>
          <div id="toggleNarutoMode" class="util-item" title="Chakra Naruto">
            <i class="bi bi-hurricane"></i>
            <span>Chakra Naruto</span>
          </div>
        </div>

        <div class="sidebar-title">Lịch sử chat</div>
        <div id="historyList" style="flex:1; overflow-y:auto; padding: 0 12px;"></div>
        
        <!-- USER FOOTER (ChatGPT style) -->
        <div class="sidebar-footer">
          <button class="user-account-btn" onclick="toggleUserMenu()">
            <div id="sidebarUserAvatar" class="avatar">U</div>
            <div class="user-info-text">
              <div id="sidebarUserName" class="user-name">User</div>
              <div class="user-plan">Btoan AI Plus</div>
            </div>
            <i class="bi bi-three-dots dots-icon"></i>
          </button>
          
          <!-- USER DROPDOWN MENU -->
          <div id="userMenu" class="user-dropdown-menu">
             <div class="menu-item" onclick="openProfile()">
               <i class="bi bi-person"></i> Hồ sơ
             </div>
             <div class="menu-item" onclick="openSettings()">
               <i class="bi bi-gear"></i> Cài đặt
               <span class="pill-zero">0</span>
             </div>
             <div class="menu-item" onclick="openHelp()">
               <i class="bi bi-question-circle"></i> Trợ giúp
             </div>
             <div class="menu-divider"></div>
             <div class="menu-item logout" onclick="logout()">
               <i class="bi bi-box-arrow-right"></i> Đăng xuất
             </div>
          </div>
        </div>
      </div>

      <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>

      <!-- MAIN CONTENT -->
      <div class="flex-grow-1 d-flex flex-column h-100">
        
        <!-- TOPBAR -->
        <div class="topbar">
          <div class="d-flex align-items-center">
            <button class="btn btn-sm d-md-none me-2" onclick="toggleSidebar()">
              <i class="bi bi-list fs-4"></i>
            </button>
            <div class="brand-text">Btoan AI</div>
          </div>
          <div class="d-flex align-items-center">
            <button class="btn btn-link text-decoration-none p-2" onclick="toggleTheme()" title="Đổi chủ đề">
              <i class="bi bi-moon-stars" id="themeIcon"></i>
            </button>
          </div>
        </div>

        <!-- CHAT AREA -->
        <main id="chat"></main>
        
        <!-- SCROLL TO BOTTOM -->
        <button id="scrollToBottomBtn" class="scroll-bottom-btn" onclick="scrollToBottom()">
            <i class="bi bi-arrow-down"></i>
        </button>

        <!-- INPUT AREA (ChatGPT style) -->
        <div class="input-container-wrapper">
          <div id="status" class="small text-center text-muted mb-2" style="display:none"></div>
          
          <div class="input-box-chatgpt">
            <button class="btn p-0 me-2 text-muted" onclick="document.getElementById('pickFile').click()" title="Đính kèm">
              <i class="bi bi-plus-circle fs-5"></i>
            </button>
            
            <textarea id="msg" class="form-control" placeholder="Bạn muốn hỏi gì hôm nay?" rows="1"></textarea>
            
            <button id="send" class="send-btn">
              <i class="bi bi-arrow-up-short fs-4"></i>
            </button>
          </div>
          
          <div id="attachments" class="mt-2 d-flex flex-wrap gap-2 justify-content-center"></div>
          
          <div class="text-center text-muted mt-2" style="font-size: 11px;">
            Btoan AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng.
          </div>
        </div>
        
      </div>
    </div>
  </div>

  <!-- HIDDEN INPUTS -->
  <input id="fileImg" type="file" accept="image/*" multiple hidden>
  <input id="fileCam" type="file" accept="image/*" capture="environment" hidden>
  <input id="fileDoc" type="file" accept=".txt,.md,.csv,.json,application/pdf,.docx" multiple hidden>

  <!-- TOAST NOTIFICATION (OK替代) -->
  <div id="floating-ok">
      <i class="bi bi-check-circle-fill text-success"></i>
      <span id="ok-text">Đã xong!</span>
  </div>

  <!-- MODALS (Profile, FaceID, etc. - Giữ nguyên logic) -->
  <?php include 'modals.php'; ?>

  <!-- JS -->
  <script src="js/app.js?v=<?php echo time(); ?>"></script>

</body>
</html>