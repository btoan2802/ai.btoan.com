<!doctype html>
<html lang="vi">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Btoan AI</title>
  <base href="/">
  <link rel="icon" href="favicon.ico">

  <!-- CSS Library -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">

  <!-- CSS Local -->
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="login/SignUp_LogIn_Form.css">
  <link rel="stylesheet" href="css/main_style.css?v=<?php echo time(); ?>">

  <!-- JS Library -->
  <script src="js/mathjax_config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
</head>

<body>

  <!-- A. LOGIN -->
  <div id="loginBox" style="display:none">
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
    </div>
  </div>

  <!-- B. CHAT APP -->
  <div id="chatApp" style="display:none">
    <div class="main-app-wrapper">

      <!-- SIDEBAR (Layout Cũ) -->
      <div id="sidebar" class="sidebar">
        <div class="sidebar-header">
           <div class="brand-box">
             <div class="brand-logo">B</div>
             <div class="brand-text">Btoan AI</div>
           </div>
           <button class="new-chat-btn" onclick="newChat()" title="Chat mới">
              <i class="bi bi-plus-lg"></i>
           </button>
        </div>
        
        <div class="sidebar-content">
          <div class="nav-links">
            <a href="./code/code.php" class="nav-item">
              <i class="bi bi-code-slash"></i> <span>Btoan AI Code</span>
            </a>
            <div class="nav-item" id="toggleHandMode">
              <i class="bi bi-hand-index-thumb"></i> <span>Điều khiển tay</span>
            </div>
            <div class="nav-item" id="toggleNarutoMode">
              <i class="bi bi-hurricane"></i> <span>Chakra Naruto</span>
            </div>
          </div>

          <div class="sidebar-divider"></div>
          <div class="sidebar-title">Lịch sử chat</div>
          <div id="historyList"></div>
        </div>
        
        <!-- USER FOOTER (Gọn gàng) -->
        <div class="sidebar-footer">
          <div class="profile-card" onclick="toggleUserMenu()">
            <div id="sidebarUserAvatar" class="avatar">U</div>
            <div id="sidebarUserName" class="user-name">User</div>
            <i class="bi bi-three-dots dots-icon"></i>
          </div>
          
          <div id="userMenu" class="user-menu">
             <div class="menu-item" onclick="openProfile()">
               <i class="bi bi-person"></i> <span>Hồ sơ</span>
             </div>
             <div class="menu-item" onclick="openSettings()">
               <i class="bi bi-gear"></i> <span>Cài đặt</span>
             </div>
             <div class="menu-item" onclick="openHelp()">
               <i class="bi bi-question-circle"></i> <span>Trợ giúp</span>
             </div>
             <div class="menu-divider"></div>
             <div class="menu-item text-danger" onclick="logout()">
               <i class="bi bi-box-arrow-right"></i> <span>Đăng xuất</span>
             </div>
          </div>
        </div>
      </div>

      <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>

      <!-- MAIN CONTENT -->
      <div class="content-wrapper">
        
        <!-- TOPBAR -->
        <div class="topbar">
          <div class="topbar-left">
            <button class="menu-toggle-btn d-md-none" onclick="toggleSidebar()">
              <i class="bi bi-list"></i>
            </button>
            <div class="topbar-brand">Btoan AI</div>
          </div>
          <div class="topbar-right">
            <button class="icon-btn" onclick="toggleTheme()" title="Đổi chủ đề">
              <i class="bi bi-moon-stars" id="themeIcon"></i>
            </button>
          </div>
        </div>

        <!-- CHAT AREA -->
        <div id="chat" class="chat-container"></div>
        
        <!-- SCROLL TO BOTTOM -->
        <button id="scrollToBottomBtn" class="scroll-bottom-btn" onclick="scrollToBottom()">
            <i class="bi bi-arrow-down"></i>
        </button>

        <!-- INPUT AREA (Cấu trúc cũ) -->
        <div class="input-area">
          <div id="status" class="status-text"></div>
          <div class="input-wrapper">
            <button class="attach-btn" onclick="document.getElementById('fileDoc').click()">
              <i class="bi bi-plus-lg"></i>
            </button>
            <textarea id="msg" placeholder="Nhập tin nhắn..." rows="1"></textarea>
            <button id="send" class="send-btn">
              <i class="bi bi-arrow-up-short"></i>
            </button>
          </div>
          <div id="attachments" class="attachments-list"></div>
          <div class="footer-note">Btoan AI có thể mắc lỗi.</div>
        </div>
        
      </div>
    </div>
  </div>

  <input id="fileImg" type="file" accept="image/*" multiple hidden>
  <input id="fileCam" type="file" accept="image/*" capture="environment" hidden>
  <input id="fileDoc" type="file" accept=".txt,.md,.csv,.json,application/pdf,.docx" multiple hidden>

  <div id="floating-ok">
      <i class="bi bi-check-circle-fill"></i>
      <span id="ok-text">Đã xong!</span>
  </div>

  <?php include 'modals.php'; ?>
  <script src="js/app.js?v=<?php echo time(); ?>"></script>
</body>
</html>