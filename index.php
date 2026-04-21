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
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap" rel="stylesheet">

  <!-- 4. CSS Local -->
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="login/SignUp_LogIn_Form.css">
  <link rel="stylesheet" href="css/main_style.css?v=11">

  <!-- 5. Config Script (Ngắn) -->
  <script src="js/mathjax_config.js"></script>

  <!-- 6. JS Library Cần Load Sớm -->
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>

  <!-- MediaPipe Core (Moved to head for reliability) -->
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
          <div class="forgot-link"><a href="#">Forgot Password?</a></div>
          <button type="submit" class="btn">Login</button>
          <button type="button" id="face-login-btn" class="btn btn-face">
            <i class='bx bx-scan'></i> Đăng nhập khuôn mặt
          </button>
          <div id="face-login-status"></div>
          <div class="switch-auth">Chưa có tài khoản? <span onclick="showRegisterForm()">Đăng ký</span></div>
          <p>or login with social platforms</p>
          <div class="social-icons">
            <div id="g_id_onload"
              data-client_id="988870371741-2qt9rtkb37oo71dmtst492j2unvfo569.apps.googleusercontent.com"
              data-callback="handleGoogleLogin" data-auto_prompt="false"></div>
            <div class="g_id_signin" data-type="standard" data-size="large"></div>
          </div>
        </form>
      </div>

      <div class="form-box register" id="registerForm">
        <form onsubmit="event.preventDefault(); register();">
          <div id="registerMsg" style="color:red;"></div>
          <h1>Registration</h1>
          <div class="input-box">
            <input id="reg_username" type="text" placeholder="Username" required>
            <i class='bx bxs-user'></i>
          </div>
          <div class="input-box">
            <input id="reg_password" type="password" placeholder="Password" required>
            <i class='bx bxs-lock-alt'></i>
          </div>
          <div class="input-box">
            <input id="reg_password2" type="password" placeholder="Confirm Password" required>
            <i class='bx bxs-lock-alt'></i>
          </div>
          <button type="submit" class="btn">Register</button>
          <div class="switch-auth">Đã có tài khoản? <span onclick="showLoginForm()">Đăng nhập</span></div>
          <p>or register with social platforms</p>
          <div class="social-icons">
            <div id="g_id_onload"
              data-client_id="988870371741-2qt9rtkb37oo71dmtst492j2unvfo569.apps.googleusercontent.com"
              data-callback="handleGoogleLogin" data-auto_prompt="false"></div>
            <div class="g_id_signin" data-type="standard" data-size="large"></div>
          </div>
        </form>
      </div>

      <div class="toggle-box">
        <div class="toggle-panel toggle-left">
          <h1>Welcome Back!</h1>
          <p>Don't have an account?</p>
          <button class="btn register-btn">Register</button>
        </div>
        <div class="toggle-panel toggle-right">
          <h1>Hello, Welcome!</h1>
          <p>Already have an account?</p>
          <button class="btn login-btn">Login</button>
        </div>
      </div>
    </div>
  </div>

  <!-- B. CHAT APP -->
  <div id="chatApp" style="display:none">
    <div class="d-flex" style="height:100vh">
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
        <div class="sidebar-utils">
          <a href="./code/code.php" class="util-item" title="Btoan Code IDE">
            <i class="bi bi-journal-code"></i>
            <span>Btoan AI Code</span>
          </a>
          <div id="toggleHandMode" class="util-item" style="cursor:pointer;" title="Bật/Tắt Hand Interaction">
            <i class="bi bi-hand-index"></i>
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
          <div class="logout-wrapper" onclick="logout()" title="Đăng xuất">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Đăng xuất</span>
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

            <div id="userBox" class="user-box">
              <div class="user-info" onclick="toggleUserMenu()">
                <div id="userAvatar" class="avatar">U</div>
                <div id="userName" class="user-name">User</div>
                <div class="arrow">▾</div>
              </div>
               <div id="userMenu" class="user-menu">
                 <div class="menu-item-premium" onclick="openProfile()">
                   <div class="menu-item-icon">
                     <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                   </div>
                   <span>Hồ sơ cá nhân</span>
                 </div>
                 <div class="menu-item-divider"></div>
                 <div class="menu-item-premium text-danger" onclick="logout()">
                   <div class="menu-item-icon">
                     <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                   </div>
                   <span>Đăng xuất</span>
                 </div>
               </div>


            </div>
          </div>
        </div>

        <main id="chat" class="flex-grow-1 p-3"></main>
        <div id="status" class="p-2 text-muted" style="display:none"></div>

        <div class="p-2 border-top">
          <div class="d-flex align-items-center">
            <input id="fileImg" type="file" accept="image/*" multiple hidden>
            <input id="fileCam" type="file" accept="image/*" capture="environment" hidden>
            <input id="fileDoc" type="file"
              accept=".txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple hidden>

            <div class="chat-actions-group">
              <button class="action-icon-btn" data-bs-toggle="dropdown" title="Tính năng thêm">
                <i class="bi bi-plus-lg"></i>
              </button>

              <ul class="dropdown-menu">
                <li><button id="pickImage" class="dropdown-item">🖼️ Gửi ảnh</button></li>
                <li><button id="pickCamera" class="dropdown-item">📷 Chụp ảnh</button></li>
                <li><button id="pickFile" class="dropdown-item">📄 Gửi tệp</button></li>
                <li>
                  <hr>
                </li>
                <li><button class="dropdown-item" onclick="setMode('fast')">⚡ Fast</button></li>
                <li><button class="dropdown-item" onclick="setMode('thinking')">🧠 Thinking</button></li>
              </ul>
            </div>

            <textarea id="msg" class="form-control mx-2" placeholder="nhập tin nhắn..." rows="1"></textarea>
            <button id="send" class="btn btn-primary send-btn"><i class="bi bi-send"></i></button>
          </div>
        </div>
        <div id="attachments"></div>
        <div class="text-center small p-2">
          Btoan AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng. Mọi thắc mắc liên hệ <a style="color: black;"
            href="https://github.com/btoan2802" target="_blank">admin</a>
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
        <button onclick="document.getElementById('avatarInput').click()" class="btn btn-light btn-sm mt-2">Đổi
          ảnh</button>
      </div>
      <div class="profile-title">Thông tin cá nhân</div>
      <div id="profileMsg" class="text-danger mb-2"></div>
      <input id="pf_name" class="form-control mb-2" placeholder="Họ và tên">
      <input id="pf_dob" class="form-control mb-3" placeholder="dd/mm/yyyy">
      <button type="button" id="face-enroll-btn-profile" class="btn btn-face-enroll w-100 mb-3"
        style="background: #edf2ff; color: #7494ec; border: none; font-size: 14px; height: 40px;">
        <i class='bx bx-face'></i> Thiết lập khuôn mặt (FaceID)
      </button>
      <button onclick="saveProfile()" class="btn btn-primary w-100">Lưu thay đổi</button>
    </div>
  </div>

  <!-- D. FACE ENROLL MODAL -->
  <div id="face-enroll-modal"
    style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:20000000; align-items:center; justify-content:center; backdrop-filter: blur(8px);">
    <div
      style="background:#fff; padding:30px; border-radius:24px; width:420px; max-width:92%; text-align:center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
      <h3 style="margin-top:0; font-weight:700; color:#1e293b; margin-bottom:10px;">Thiết lập FaceID</h3>
      <p style="color:#64748b; font-size:14px; margin-bottom:20px;">Giữ điện thoại thẳng mặt và đảm bảo đủ ánh sáng</p>
      <div
        style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; border-radius:50%; border:4px solid #7494ec; background:#000; margin-bottom:20px;">
        <video id="face-video" autoplay playsinline
          style="width:100%; height:100%; object-fit:cover; transform: scaleX(-1);"></video>
        <div id="scan-line"
          style="position:absolute; top:0; left:0; width:100%; height:2px; background:linear-gradient(to right, transparent, #7494ec, transparent); box-shadow: 0 0 15px #7494ec; animation: scanAnim 2s infinite linear; display:none;">
        </div>
      </div>
      <canvas id="face-canvas" style="display:none;"></canvas>
      <div id="face-enroll-status" style="min-height:20px; margin-bottom:15px;"></div>
      <button type="button" id="face-close-btn" class="btn btn-danger"
        style="background:#ef4444; height:44px; font-size:14px;">Hủy bỏ</button>
    </div>
  </div>

  <!-- E. HAND OVERLAY -->
  <div id="hand-overlay"
    style="display:none; position:fixed; inset:0; z-index:999999; pointer-events:none; background: rgba(0,0,0,0.05); overflow:hidden;">
    <div id="shape-container"
      style="position:absolute; inset:0; pointer-events:none; z-index:15; perspective: 1200px; transform-style: preserve-3d;">
    </div>
    <div id="hud-container"
      style="position:absolute; inset:0; pointer-events:none; font-family:'JetBrains Mono', monospace;">
      <div
        style="position:absolute; top:30px; left:40px; right:40px; display:flex; justify-content:space-between; align-items:center;">
        <div id="hand-mode-label"
          style="font-size:14px; font-weight:900; color:#00ffcc; background:rgba(0,0,0,0.8); padding:6px 15px; border:1px solid #00ffcc; letter-spacing:2px; pointer-events:auto;">
          3D SPATIAL</div>
        <button onclick="window.shapeManager.reset()"
          style="background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; padding:6px 15px; font-size:11px; cursor:pointer; pointer-events:auto;">RESET
          SCENE</button>
      </div>
    </div>
    <div id="cursor-left" class="hand-cursor"
      style="position:absolute; width:80px; height:80px; display:none; pointer-events:none; z-index:1000000;">
      <div
        style="position:absolute; inset:25px; border:2px solid #00ffcc; border-radius:50%; box-shadow:0 0 15px rgba(0,255,204,0.4);">
      </div>
    </div>
    <div id="cursor-right" class="hand-cursor"
      style="position:absolute; width:80px; height:80px; display:none; pointer-events:none; z-index:1000000;">
      <div
        style="position:absolute; inset:25px; border:2px solid #00ffcc; border-radius:50%; box-shadow:0 0 15px rgba(0,255,204,0.4);">
      </div>
    </div>
    <div id="hand-camera-container"
      style="position:absolute; bottom:30px; left:30px; width:220px; aspect-ratio:4/3; background:#000; border-radius:15px; border:1px solid rgba(0, 255, 204, 0.4); overflow:hidden; pointer-events:auto;">
      <video id="hand-video" autoplay playsinline
        style="width:100%; height:100%; object-fit:cover; transform: scaleX(-1); opacity:0.8;"></video>
      <canvas id="hand-canvas"
        style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; transform: scaleX(-1);"></canvas>
      <button onclick="window.handEngine.stop()"
        style="position:absolute; top:10px; right:10px; background:none; border:none; color:#00ffcc; cursor:pointer;"><i
          class="bi bi-x-circle"></i></button>
    </div>
  </div>

  <!-- F. NARUTO OVERLAY -->
  <div id="naruto-overlay"
    style="display:none; position:fixed; inset:0; z-index:9999999; background:#000; overflow:hidden;">
    <video id="naruto-camera" autoplay playsinline muted
      style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); opacity:0.85;"></video>
    <div id="naruto-fx-layer" style="position:absolute; inset:0; pointer-events:none;"></div>
    <canvas id="naruto-canvas"
      style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;"></canvas>
    <div
      style="position:absolute; top:20px; left:0; right:0; display:flex; justify-content:center; pointer-events:none;">
      <div
        style="background:rgba(0,0,0,0.6); color:#f97316; font-weight:900; font-size:16px; padding:8px 24px; border:1px solid #f97316; border-radius:4px;">
        🌀 Btoan Mode songoku</div>
    </div>
    <div id="naruto-score"
      style="position:absolute; top:20px; right:24px; background:rgba(0,0,0,0.7); color:#facc15; font-size:20px; padding:8px 18px; border:1px solid #facc15; border-radius:6px;">
      💠 0</div>
    <button onclick="closeNaruto()"
      style="position:absolute; top:20px; left:20px; background:rgba(220,38,38,0.85); border:none; color:#fff; font-size:14px; padding:8px 16px; border-radius:8px; cursor:pointer; z-index:10;">✕
      Đóng</button>
  </div>

  <!-- Cuối body: Toàn bộ script -->

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://unpkg.com/mammoth/mammoth.browser.min.js"></script>
  <script src="https://unpkg.com/docx@7.7.0/build/index.js"></script>
  <script src="facelib/face-api.min.js"></script>
  <script src="login/SignUp_LogIn_Form.js?v=19"></script>
  <script src="js/app.js?v=21"></script>
  <script src="js/hand_scene.js?v=9"></script>
  <script src="js/hand_shapes.js?v=4"></script>
  <script src="js/hand_engine.js?v=11"></script>
  <script src="js/naruto_mode.js?v=35"></script>

  <!-- G. IMAGE PREVIEW MODAL -->
  <div id="image-preview-modal" class="image-preview-modal" onclick="closeImagePreview()">
    <span class="close-preview">&times;</span>
    <img id="preview-img" class="preview-content" src="" alt="Preview">
  </div>
</body>


</html>