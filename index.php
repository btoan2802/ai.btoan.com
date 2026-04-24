<?php
include 'login/Check_LogIn.php';
?>
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Btoan AI - ChatGPT Style</title>
  <link rel="icon" type="image/x-icon" href="https://btoan.com/images/favicon.ico">
  
  <!-- CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="/css/style.css?v=21">
  <link rel="stylesheet" href="/css/main_style.css?v=30">
</head>

<body>

  <!-- A. LOGIN BOX -->
  <div id="loginBox" class="login-overlay">
    <div class="login-card">
      <div class="login-header">
        <img src="https://btoan.com/images/logo.png" alt="Logo" class="login-logo">
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập để tiếp tục với Btoan AI</p>
      </div>

      <div id="loginForm">
        <div class="mb-3">
          <div class="input-group-premium">
            <i class="bi bi-person"></i>
            <input type="text" id="l_user" placeholder="Tên đăng nhập">
          </div>
        </div>
        <div class="mb-3">
          <div class="input-group-premium">
            <i class="bi bi-lock"></i>
            <input type="password" id="l_pass" placeholder="Mật khẩu">
            <i class="bi bi-eye toggle-password" onclick="togglePassword('l_pass', this)"></i>
          </div>
        </div>
        <button onclick="login()" class="btn btn-primary w-100 login-btn-premium mb-3">Đăng nhập</button>
        
        <div class="separator"><span>Hoặc</span></div>
        
        <div class="d-flex justify-content-center mb-3">
            <div id="g_id_onload"
                 data-client_id="866785002016-e5uueovfsl3j3d5p07p99qom6q233j81.apps.googleusercontent.com"
                 data-callback="handleGoogleLogin">
            </div>
            <div class="g_id_signin" data-type="standard"></div>
        </div>

        <p class="text-center mt-3 small">Chưa có tài khoản? <a href="javascript:void(0)" onclick="showRegister()">Đăng ký ngay</a></p>
      </div>

      <div id="registerForm" style="display:none">
        <div class="mb-3">
          <div class="input-group-premium">
            <i class="bi bi-person-plus"></i>
            <input type="text" id="r_user" placeholder="Tên đăng nhập mới">
          </div>
        </div>
        <div class="mb-3">
          <div class="input-group-premium">
            <i class="bi bi-lock"></i>
            <input type="password" id="r_pass" placeholder="Mật khẩu">
          </div>
        </div>
        <button onclick="register()" class="btn btn-success w-100 login-btn-premium mb-3">Đăng ký tài khoản</button>
        <p class="text-center mt-3 small">Đã có tài khoản? <a href="javascript:void(0)" onclick="showLogin()">Đăng nhập</a></p>
      </div>
    </div>
  </div>

  <!-- B. CHAT APP -->
  <div id="chatApp" style="display:none">
    <div class="d-flex main-app-wrapper">

      <div id="sidebar" class="sidebar">
        <div class="sidebar-header">
           <div class="new-chat-wrapper" onclick="newChat()" title="Chat mới">
              <i class="bi bi-plus-lg"></i>
              <span>Chat mới</span>
           </div>
           <button class="icon-toggle-btn" onclick="toggleSidebar()" title="Đóng sidebar">
              <i class="bi bi-layout-sidebar"></i>
           </button>
        </div>

        <div class="sidebar-utils p-2">
          <div id="toggleHandMode" class="util-item" style="cursor:pointer;" title="Bật/Tắt điều khiển bằng tay">
            <i class="bi bi-hand-index-thumb"></i>
            <span>Điều khiển tay</span>
          </div>
          <div id="toggleNarutoMode" class="util-item" style="cursor:pointer;" title="Bật/Tắt hiệu ứng Naruto">
            <i class="bi bi-hurricane"></i>
            <span>Chakra Naruto</span>
          </div>
        </div>

        <div class="sidebar-title">Lịch sử chat</div>
        <div id="historyList" style="flex:1; overflow-y:auto;"></div>
        
        <div class="sidebar-footer">
          <div class="profile-card-sidebar" onclick="toggleUserMenu()">
            <div id="sidebarUserAvatar" class="avatar">U</div>
            <div class="user-info-text">
              <span id="sidebarUserName" class="user-name">User</span>
              <span class="user-subtext">Btoan AI Plus</span>
            </div>
            <div class="more-icon">
              <i class="bi bi-three-dots"></i>
            </div>
          </div>
          
          <div id="userMenu" class="user-menu">
             <div class="menu-item" onclick="openProfile()">
               <i class="bi bi-person"></i>
               <span>Hồ sơ</span>
             </div>
             <div class="menu-item" onclick="alert('Settings coming soon')">
               <i class="bi bi-gear"></i>
               <span>Cài đặt</span>
             </div>
             <div class="menu-item" onclick="window.open('https://github.com/btoan2802', '_blank')">
               <i class="bi bi-question-circle"></i>
               <span>Trợ giúp</span>
             </div>
             <div class="menu-divider"></div>
             <div class="menu-item text-danger" onclick="logout()">
               <i class="bi bi-box-arrow-right"></i>
               <span>Đăng xuất</span>
             </div>
          </div>
        </div>
      </div>

      <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>

      <div class="flex-grow-1 d-flex flex-column">
        <div class="topbar">
          <div class="topbar-left">
            <button class="icon-toggle-btn" id="openSidebarBtn" onclick="toggleSidebar()" title="Mở sidebar">
              <i class="bi bi-layout-sidebar"></i>
            </button>
            <div class="brand-text">Btoan AI</div>
          </div>
          <div class="ms-auto d-flex align-items-center">
            <button class="icon-toggle-btn me-2" id="themeToggleBtn" onclick="toggleTheme()" title="Đổi chế độ sáng/tối">
              <i class="bi bi-moon-stars"></i>
            </button>
          </div>
        </div>

        <main id="chat" class="flex-grow-1 p-3"></main>
        
        <button id="scrollToBottomBtn" class="scroll-bottom-btn" title="Cuộn xuống dưới">
            <i class='bx bx-chevron-down'></i>
        </button>

        <div id="status" class="p-2 text-muted" style="display:none"></div>

        <div class="input-container">
          <div class="input-box-wrapper">
            <div class="chat-actions-group">
              <button class="action-icon-btn" data-bs-toggle="dropdown" title="Tính năng thêm">
                <i class="bi bi-plus-lg"></i>
              </button>
              <span id="modeStatus" class="badge bg-light text-dark" style="font-size:0.7rem; cursor:pointer;">⚡ Fast</span>

              <ul class="dropdown-menu shadow-md border-0 profile-menu-premium">
                <li><button id="pickImage" class="dropdown-item py-2"><i class="bi bi-image me-2 text-primary"></i> Gửi ảnh</button></li>
                <li><button id="pickCamera" class="dropdown-item py-2"><i class="bi bi-camera me-2 text-success"></i> Chụp ảnh</button></li>
                <li><button id="pickFile" class="dropdown-item py-2"><i class="bi bi-file-earmark-text me-2 text-info"></i> Gửi tệp</button></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item py-2" onclick="setMode('fast')"><i class="bi bi-lightning-charge-fill me-2 text-warning"></i> Fast</button></li>
                <li><button class="dropdown-item py-2" onclick="setMode('thinking')"><i class="bi bi-brain me-2 text-purp"></i> Thinking</button></li>
              </ul>
            </div>

            <textarea id="msg" class="form-control" placeholder="nhập tin nhắn..." rows="1"></textarea>
            <button id="send" class="btn send-btn"><i class="bi bi-arrow-up-short" style="font-size: 1.5rem;"></i></button>
          </div>
          
          <div id="attachments" class="mt-2"></div>
          
          <div class="text-center small mt-2" style="color: var(--text-muted); font-size: 11px;">
            Btoan AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng. Mọi thắc mắc liên hệ <a style="color: var(--text-main);" href="https://github.com/btoan2802" target="_blank">admin</a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- C. PROFILE MODAL -->
  <div id="profileModal" class="profile-modal" style="display:none">
    <div class="profile-card">
      <div class="avatar-upload">
        <div id="avatarPreview" class="avatar-preview">U</div>
        <input type="file" id="avatarInput" accept="image/*" style="display:none">
        <button onclick="document.getElementById('avatarInput').click()" class="btn btn-light btn-sm mt-2">Đổi ảnh</button>
      </div>
      <div class="profile-title">Thông tin cá nhân</div>
      <div id="profileMsg" class="text-danger mb-2"></div>
      <input id="pf_name" class="form-control mb-2" placeholder="Họ và tên">
      <input id="pf_dob" class="form-control mb-3" placeholder="dd/mm/yyyy">
      <button type="button" id="face-enroll-btn-profile" class="btn btn-face-enroll w-100 mb-3" style="background: #edf2ff; color: #7494ec; border: none; font-size: 14px; height: 40px;">
        <i class='bx bx-face'></i> Thiết lập FaceID
      </button>
      <button onclick="saveProfile()" class="btn btn-primary w-100">Lưu thay đổi</button>
      <button onclick="document.getElementById('profileModal').style.display='none'" class="btn btn-link w-100 mt-2 text-muted">Đóng</button>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/mammoth/mammoth.browser.min.js"></script>
  <script src="https://unpkg.com/docx@7.7.0/build/index.js"></script>
  <script src="/facelib/face-api.min.js"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="/login/SignUp_LogIn_Form.js?v=20"></script>
  <script src="/js/app.js?v=30"></script>
  <script src="/js/hand_scene.js?v=10"></script>
  <script src="/js/hand_shapes.js?v=5"></script>
  <script src="/js/hand_engine.js?v=12"></script>
  <script src="/js/naruto_mode.js?v=36"></script>

  <div id="image-preview-modal" class="image-preview-modal" onclick="closeImagePreview()">
    <span class="close-preview">&times;</span>
    <img id="preview-img" class="preview-content" src="" alt="Preview">
  </div>
</body>
</html>