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

    <div class="container active">
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

        <button type="button" id="face-enroll-btn" class="btn btn-face-enroll">
          <i class='bx bx-face'></i> Thiết lập khuôn mặt (FaceID)
        </button>


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

          <button type="button" id="face-enroll-btn-reg" class="btn btn-face-enroll" style="margin-bottom:15px;">
            <i class='bx bx-face'></i> Thiết lập khuôn mặt (Tùy chọn)
          </button>

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
    </style>


  <script src="login/SignUp_LogIn_Form.js?v=5"></script>
  <script src="./app.js?v=5"></script>
  <script src="https://api.1aie.com/?key=839c8d618a53c29f602af9943ad7fcc5&active=kyc"></script>
</body>

</html>