<!doctype html>
<html lang="vi">

<head>

  <link rel="icon" href="favicon.ico">

  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      },
      svg: {
        fontCache: 'global'
      }
    };
  </script>

  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">

  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap" rel="stylesheet">

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">

  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>Btoan AI</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">

  <link rel="stylesheet" href="./style.css">
  <link rel="stylesheet" href="login/SignUp_LogIn_Form.css">
  <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>

  <!-- MediaPipe Core (Moved to head for reliability) -->
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

  <style>
    /* GLOBAL */

    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto;
      background: #f8fafc;
      height: 100vh;
    }

    /* LOGIN */

    #loginBox {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }

    .auth-card {
      width: 360px;
      background: #fff;
      border-radius: 14px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .auth-title {
      font-size: 26px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 20px;
    }

    .form-control {
      border-radius: 8px;
      padding: 10px 12px;
    }

    .password-box {
      position: relative;
    }

    .toggle-pass {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      color: #888;
    }

    .btn-primary {
      background: #2b7cff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
    }

    .btn-primary:hover {
      background: #1f63d6;
    }

    .btn-success {
      border-radius: 8px;
      font-weight: 600;
    }

    .btn-outline-secondary {
      border-radius: 8px;
    }

    #loginMsg,
    #registerMsg {
      font-size: 14px;
      min-height: 18px;
    }

    .auth-footer {
      text-align: center;
      margin-top: 15px;
      font-size: 14px;
      color: #666;
    }

    .auth-footer span {
      color: #7494ec;
      cursor: pointer;
      font-weight: 600;
    }

    /* CUSTOM SCROLLBAR */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* APP */

    #chatApp {
      display: none;
      width: 100%;
      height: 100vh;
      background: #f4f6fb;
    }

    .sidebar {
      width: 280px;
      background: #fff;
      flex-shrink: 0;
      border-right: 1px solid #eee;
      height: 100vh;
      overflow-y: auto;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        transform: translateX(-100%);
        box-shadow: 10px 0 30px rgba(0,0,0,0.1);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 999;
        backdrop-filter: blur(2px);
      }
      .sidebar.open + .sidebar-overlay {
        display: block;
      }
    }

    .sidebar-title {
      font-weight: bold;
      padding: 15px;
      border-bottom: 1px solid #eee;
    }

    .chat-history-item {
      padding: 12px 15px;
      cursor: pointer;
      border-bottom: 1px solid #f8fafc;
      font-size: 14px;
      transition: all 0.2s;
      border-radius: 8px;
      margin: 4px 8px;
    }

    .chat-history-item:hover {
      background: #f1f5f9;
      transform: translateX(4px);
    }

    .topbar {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #eee;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .menu-btn {
      font-size: 20px;
      margin-right: 10px;
      cursor: pointer;
      border: none;
      background: none;
    }

    #chat {
      overflow: auto;
    }

    .new-chat-btn {
      padding: 10px;
      margin: 10px;
      background: #2b7cff;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      font-weight: 600;
    }

    .new-chat-btn:hover {
      background: #1f63d6;
    }
    /* PROFILE MODAL */
    .profile-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .profile-card {
      background: #fff;
      width: 380px;
      padding: 30px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .avatar-upload {
      text-align: center;
      margin-bottom: 20px;
    }
    .avatar-preview {
      width: 80px;
      height: 80px;
      background: #2b7cff;
      color: #fff;
      font-size: 32px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      margin: 0 auto;
      object-fit: cover;
    }
    .profile-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 20px;
      text-align: center;
    }
    .chat-actions-group {
      position: relative;
    }
    .btn-action-plus {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      transition: all 0.2s;
    }
    .btn-action-plus:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    #msg {
      border-radius: 24px;
      padding: 10px 20px;
      background: #f1f5f9;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    #msg:focus {
      background: #fff;
      border-color: #7494ec;
      box-shadow: 0 0 0 4px rgba(116, 148, 236, 0.1);
    }
    .send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
    }
  </style>

  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>

<body>

  <!-- LOGIN -->

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
          <div class="forgot-link">
            <a href="#">Forgot Password?</a>
          </div>
          <button type="submit" class="btn">Login</button>

        <!-- login with face ID -->
        <button type="button" id="face-login-btn" class="btn btn-face">
          <i class='bx bx-scan'></i> Đăng nhập khuôn mặt
        </button>
        <div id="face-login-status"></div>



          <div class="switch-auth">
            Chưa có tài khoản?
            <span onclick="showRegisterForm()">Đăng ký</span>
          </div>
          <p>or login with social platforms</p>
          <div class="social-icons">

            <div id="g_id_onload"
              data-client_id="988870371741-2qt9rtkb37oo71dmtst492j2unvfo569.apps.googleusercontent.com"
              data-callback="handleGoogleLogin" data-auto_prompt="false">
            </div>

            <div class="g_id_signin" data-type="standard" data-size="large">
            </div>
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
          <div class="switch-auth">
            Đã có tài khoản?
            <span onclick="showLoginForm()">Đăng nhập</span>
          </div>
          <p>or register with social platforms</p>

          <div class="social-icons">

            <div id="g_id_onload"
              data-client_id="988870371741-2qt9rtkb37oo71dmtst492j2unvfo569.apps.googleusercontent.com"
              data-callback="handleGoogleLogin" data-auto_prompt="false">
            </div>

            <div class="g_id_signin" data-type="standard" data-size="large">
            </div>
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


  <!-- PROFILE -->
  <!-- <div id="profileBox" style="display:none; align-items:center; justify-content:center; height:100vh;">

    <div class="auth-card">

      <div class="auth-title">Hoàn thiện thông tin</div>

      <div id="profileMsg" class="text-danger mb-2"></div>

      <input id="pf_name" class="form-control mb-3" placeholder="Họ và tên">

      <input id="pf_dob" type="text" class="form-control mb-3" placeholder="dd/mm/yyyy">

      <button type="button" onclick="saveProfile()" class="btn btn-primary w-100">
        Xác nhận
      </button>

    </div>

  </div> -->


  <!-- APP -->

  <div id="chatApp" style="display:none">

    <div class="d-flex" style="height:100vh">

      <!-- SIDEBAR -->

      <div id="sidebar" class="sidebar">
        <div class="new-chat-btn" onclick="newChat()">+ Chat mới</div>

        <div class="sidebar-title">
          Lịch sử chat
        </div>

        <div id="historyList" style="flex:1; overflow-y:auto;"></div>
        <div style="padding:15px; margin-top:auto;">
          <button class="btn btn-danger w-100" onclick="logout()">
            🚪 Đăng xuất
          </button>
        </div>

      </div>
      <div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>


      <!-- MAIN -->

      <div class="flex-grow-1 d-flex flex-column">


        <!-- TOPBAR -->

        <div class="topbar">

          <button class="menu-btn" onclick="toggleSidebar()">☰</button>

          <div class="d-flex align-items-center gap-2">
            <div class="fw-bold">Btoan AI</div>

            <a href="./code/code.php" class="code-entry-btn">
              <i class="bi bi-code-slash"></i>
              <span>Code</span>
            </a>

            <!-- ✅ HAND MODE BTN -->
            <button id="toggleHandMode" class="code-entry-btn" style="background:#edf2ff; color:#2b7cff; border:none; margin-left:8px;">
              <i class="bi bi-hand-index-thumb"></i>
              <span>Hand Mode</span>
            </button>
          </div>

          <div class="ms-auto d-flex align-items-center">

            <div id="userBox" class="user-box">

              <div class="user-info" onclick="toggleUserMenu()">
                <div id="userAvatar" class="avatar">U</div>
                <div id="userName" class="user-name">User</div>
                <div class="arrow">▾</div>
              </div>

              <div id="userMenu" class="user-menu">
                <div class="menu-item" onclick="openProfile()">👤 Hồ sơ</div>
                <div class="menu-item" onclick="logout()">🚪 Đăng xuất</div>
              </div>

            </div>

          </div>

        </div>


        <!-- CHAT -->

        <main id="chat" class="flex-grow-1 p-3"></main>

        <div id="status" class="p-2 text-muted" style="display:none"></div>


        <!-- INPUT -->

        <div class="p-2 border-top">

          <div class="d-flex align-items-center">

            <input id="fileImg" type="file" accept="image/*" multiple hidden>
            <input id="fileCam" type="file" accept="image/*" capture="environment" hidden>
            <input id="fileDoc" type="file"
              accept=".txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple hidden>

            <!-- ✅ NÚT + -->
            <div class="chat-actions-group">
              <button class="btn btn-action-plus" data-bs-toggle="dropdown">
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

            <button id="send" class="btn btn-primary send-btn">
              <i class="bi bi-send"></i>
            </button>

          </div>

        </div>

        <div id="attachments"></div>
        <div class="text-center small p-2">
          Btoan AI có thể mắc lỗi. Hãy kiểm tra các thông tin quan trọng. Mọi thắc mắc liên hệ <a style="color: black;" href="https://github.com/btoan2802" target="_blank">admin</a>
        </div>

      </div>


    </div>

  </div>





  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <script src="https://unpkg.com/mammoth/mammoth.browser.min.js"></script>

  <script src="https://unpkg.com/docx@7.7.0/build/index.js"></script>

    <div id="profileModal" class="profile-modal" style="display:none">

      <div class="profile-card">

        <!-- AVATAR -->
        <div class="avatar-upload">
          <div id="avatarPreview" class="avatar-preview">U</div>
          <input type="file" id="avatarInput" accept="image/*" style="display:none">
          <button onclick="document.getElementById('avatarInput').click()" class="btn btn-light btn-sm mt-2">
            Đổi ảnh
          </button>
        </div>

        <!-- TITLE -->
        <div class="profile-title">Thông tin cá nhân</div>

        <div id="profileMsg" class="text-danger mb-2"></div>

        <!-- NAME -->
        <input id="pf_name" class="form-control mb-2" placeholder="Họ và tên">

        <!-- DOB -->
        <input id="pf_dob" class="form-control mb-3" placeholder="dd/mm/yyyy">

        <!-- FACEID SETTING -->
        <button type="button" id="face-enroll-btn-profile" class="btn btn-face-enroll w-100 mb-3" style="background: #edf2ff; color: #7494ec; border: none; font-size: 14px; height: 40px;">
          <i class='bx bx-face'></i> Thiết lập khuôn mặt (FaceID)
        </button>

        <!-- SAVE -->
        <button onclick="saveProfile()" class="btn btn-primary w-100">
          Lưu thay đổi
        </button>

      </div>

    </div>


    <!-- FACE ENROLL MODAL -->
    <div id="face-enroll-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:20000000; align-items:center; justify-content:center; backdrop-filter: blur(8px);">
      <div style="background:#fff; padding:30px; border-radius:24px; width:420px; max-width:92%; text-align:center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
        <h3 style="margin-top:0; font-weight:700; color:#1e293b; margin-bottom:10px;">Thiết lập FaceID</h3>
        <p style="color:#64748b; font-size:14px; margin-bottom:20px;">Giữ điện thoại thẳng mặt và đảm bảo đủ ánh sáng</p>
        
        <div style="position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; border-radius:50%; border:4px solid #7494ec; background:#000; margin-bottom:20px;">
          <video id="face-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; transform: scaleX(-1);"></video>
          <!-- Scanning animation effect -->
          <div id="scan-line" style="position:absolute; top:0; left:0; width:100%; height:2px; background:linear-gradient(to right, transparent, #7494ec, transparent); box-shadow: 0 0 15px #7494ec; animation: scanAnim 2s infinite linear; display:none;"></div>
        </div>
        
        <canvas id="face-canvas" style="display:none;"></canvas>
        <div id="face-enroll-status" style="min-height:20px; margin-bottom:15px;"></div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button type="button" id="face-close-btn" class="btn btn-danger" style="background:#ef4444; height:44px; font-size:14px;">Hủy bỏ</button>
        </div>
      </div>
    </div>

    <style>
      @keyframes scanAnim {
        0% { top: 0%; }
        100% { top: 100%; }
      }
      .btn-danger {
        border-radius: 12px;
        color: #fff;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: .3s;
      }
      .btn-danger:hover {
        background: #dc2626;
        opacity: 0.9;
      }

      /* ===== HAND TRACKING UI ===== */
      #hand-camera-pip {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      #hand-camera-pip:hover {
          transform: scale(1.05);
      }
      #hand-cursor {
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
          background: rgba(255, 0, 255, 0.1);
      }
      .demo-box {
          transition: transform 0.2s, box-shadow 0.2s;
          user-select: none;
          -webkit-user-drag: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: bold;
          cursor: grab;
      }
      .demo-box:active {
          cursor: grabbing;
      }
      #hand-overlay {
          background: radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.1) 100%);
      }
      #toggleHandMode:hover {
          background: #e0e7ff !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(43, 124, 255, 0.1);
      }
      #toggleHandMode.active {
          background: #2b7cff !important;
          color: #fff !important;
      }
    </style>


  <!-- 🚀 PROFESSIONAL HAND PLAYGROUND v4.5 (GENESIS UPDATE) -->
  <div id="hand-overlay" style="display:none; position:fixed; inset:0; z-index:999999; pointer-events:none; background: radial-gradient(circle at center, #0a0f1e 0%, #02050a 100%); overflow:hidden;">
    
    <!-- Deep Fog Background -->
    <div style="position:absolute; inset:0; background: radial-gradient(50% 50% at 50% 50%, rgba(0, 255, 204, 0.05) 0%, transparent 100%); pointer-events:none;"></div>
    
    <!-- Background Architecture Grid v2 -->
    <div id="playground-grid" style="position:absolute; inset:0; background-image: 
        linear-gradient(rgba(0, 255, 204, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 255, 204, 0.03) 1px, transparent 1px);
        background-size: 60px 60px; pointer-events:none; opacity: 1;"></div>

    <!-- HUD Layout -->
    <div id="hud-container" style="position:absolute; inset:0; pointer-events:none; font-family:'JetBrains Mono', monospace;">
        <!-- Top Status Bar -->
        <div style="position:absolute; top:30px; left:40px; right:40px; display:flex; justify-content:space-between; align-items:flex-start; pointer-events:none;">
            <div>
                <div style="font-size:22px; font-weight:900; color:#00ffcc; letter-spacing:6px; text-shadow:0 0 20px rgba(0,255,204,0.3);">GENESIS_LAB</div>
                <div id="hud-system-status" style="font-size:10px; color:#00ffcc; opacity:0.6; margin-top:5px; animation: blink 2s infinite;">// PROTOCOL: ACTIVE // SYNC: 100%</div>
            </div>
            <div style="text-align:right;">
                <div id="fps-counter" style="color:#00ffcc; font-size:12px;">FPS: --</div>
                <div style="color:#00ffcc; font-size:10px; opacity:0.4;">GEN_v4.5_STABLE</div>
            </div>
        </div>

        <!-- Rulers (Dynamic) -->
        <div id="ruler-x" style="position:absolute; top:0; left:0; width:100%; height:1px; background:linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.4), transparent); pointer-events:none;"></div>
        <div id="ruler-y" style="position:absolute; top:0; left:0; width:1px; height:100%; background:linear-gradient(180deg, transparent, rgba(0, 255, 204, 0.4), transparent); pointer-events:none;"></div>
    </div>

    <!-- Interaction Stage -->
    <div id="hand-stage" style="position:absolute; inset:0; pointer-events:auto; perspective: 1500px; transform-style: preserve-3d;">
        <!-- Genesis Seeds will be placed here -->
    </div>

    <!-- Hand Cursors 2.0 (Tech Style) -->
    <div id="cursor-left" class="hand-cursor" style="position:absolute; width:100px; height:100px; display:none; pointer-events:none; z-index:1000000;">
        <div style="position:absolute; inset:20px; border:1px solid #00ffcc; border-radius:50%; box-shadow:0 0 15px rgba(0,255,204,0.3);"></div>
        <div style="position:absolute; inset:35px; border:0.5px solid #00ffcc; border-radius:50%; opacity:0.5; animation: orbit 4s linear infinite;"></div>
        <div class="cursor-status-label" style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:9px; color:#00ffcc; background:rgba(0,0,0,0.6); padding:2px 6px;">L_HAND</div>
    </div>
    <div id="cursor-right" class="hand-cursor" style="position:absolute; width:100px; height:100px; display:none; pointer-events:none; z-index:1000000;">
        <div style="position:absolute; inset:20px; border:1px solid #00ffcc; border-radius:50%; box-shadow:0 0 15px rgba(0,255,204,0.3);"></div>
        <div style="position:absolute; inset:35px; border:0.5px solid #00ffcc; border-radius:50%; opacity:0.5; animation: orbit 4s linear infinite;"></div>
        <div class="cursor-status-label" style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-size:9px; color:#00ffcc; background:rgba(0,0,0,0.6); padding:2px 6px;">R_HAND</div>
    </div>

    <!-- Webcam Preview 2.0 -->
    <div id="hand-camera-container" style="position:absolute; bottom:30px; right:30px; width:280px; aspect-ratio:4/3; background:#000; border-radius:30px; border:1px solid rgba(0, 255, 204, 0.5); overflow:hidden; pointer-events:auto; box-shadow:0 15px 60px rgba(0,0,0,0.8);">
        <video id="hand-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover; transform: scaleX(-1); opacity:0.8; filter: contrast(1.1) brightness(0.9);"></video>
        <canvas id="hand-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; transform: scaleX(-1);"></canvas>
        <div id="cam-status-badge" style="position:absolute; top:15px; right:15px; width:8px; height:8px; background:#00ffcc; border-radius:50%; box-shadow:0 0 10px #00ffcc;"></div>
    </div>
  </div>

  <style>
    @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes blink { 0% { opacity: 0.2; } 50% { opacity: 0.6; } 100% { opacity: 0.2; } }
    @keyframes genesis-pulse { 0% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 0.9; } 100% { transform: scale(1); opacity: 0.6; } }
    .seed-node { animation: genesis-pulse 3s infinite ease-in-out; }
  </style>

  <script src="login/SignUp_LogIn_Form.js?v=11"></script>
  <script src="./app.js?v=11"></script>
  <script src="hand_scene.js?v=2"></script>
  <script src="hand_genesis.js?v=1"></script>
  <script src="hand_engine.js?v=2"></script>
</body>

</html>