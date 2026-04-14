// ===== SAFE READY =====
document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');

  // Auto-fill username if available
  const lastUser = localStorage.getItem("last_logged_in_username");
  const usernameInput = document.getElementById("login_username");
  if (lastUser && usernameInput) {
    usernameInput.value = lastUser;
  }

loginForm.classList.add('active');
  function isMobile(){
    return window.innerWidth <= 768;
  }

window.showRegisterForm = function(){

  if(window.innerWidth <= 768){
    // MOBILE
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  }else{
    // DESKTOP
    container.classList.add('active');
  }

}

window.showLoginForm = function(){

  if(window.innerWidth <= 768){
    // MOBILE
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  }else{
    // DESKTOP
    container.classList.remove('active');
  }

}

  // ===== BUTTON PANEL DESKTOP =====
  if(registerBtn){
    registerBtn.onclick = window.showRegisterForm;
  }

  if(loginBtn){
    loginBtn.onclick = window.showLoginForm;
  }

  // ===== DEFAULT MOBILE =====
function setupMobile(){
  if(isMobile()){
    container.classList.remove('active'); // mặc định login
  }
}

  setupMobile();

  // ===== FIX XOAY MÀN HÌNH =====
  window.addEventListener("resize", setupMobile);




const faceLoginBtn = document.getElementById("face-login-btn");
const faceEnrollBtn = document.getElementById("face-enroll-btn");
const faceCloseBtn = document.getElementById("face-close-btn");

if (faceLoginBtn) {
  faceLoginBtn.addEventListener("click", loginWithFace);
}

if (faceEnrollBtn) {
  faceEnrollBtn.addEventListener("click", openFaceEnrollModal);
}

if (faceCloseBtn) {
  faceCloseBtn.addEventListener("click", closeFaceEnrollModal);
}

const faceEnrollBtnReg = document.getElementById("face-enroll-btn-reg");
if (faceEnrollBtnReg) {
  faceEnrollBtnReg.addEventListener("click", openFaceEnrollModal);
}

});

async function stopAllCameras() {
  try {
    const streams = await navigator.mediaDevices.enumerateDevices();
    const tracks = window.localStream ? window.localStream.getTracks() : [];
    // brute force stop all tracks we can find
    const devices = await navigator.mediaDevices.getUserMedia({video: true}).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
  } catch(e) {}
}

let isFaceLoginActive = false;
let faceStream = null;
let capturedFaceImage = "";
let autoCaptureInterval = null;
let stableStartTime = null;
let isSavingFace = false;
let autoCaptureCooldown = false;

function setFaceLoginMessage(message, isError = false) {
  const el = document.getElementById("face-login-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "red" : "green";
}

function setFaceEnrollMessage(message, isError = false) {
  const el = document.getElementById("face-enroll-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "red" : "green";
}

function getActiveUsernameInput() {
  // Check which form is active
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (registerForm && registerForm.classList.contains('active')) {
    return document.getElementById("reg_username");
  }
  
  return document.getElementById("login_username")
    || document.getElementById("username")
    || document.querySelector('input[name="username"]');
}

async function openFaceEnrollModal() {
  const usernameInput = getActiveUsernameInput();
  if (!usernameInput || !usernameInput.value.trim()) {
    const isReg = document.getElementById('registerForm')?.classList.contains('active');
    const msg = isReg ? "Vui lòng nhập tên đăng ký trước" : "Vui lòng nhập username trước";
    if (isReg) {
       document.getElementById("registerMsg").textContent = msg;
    } else {
       setFaceLoginMessage(msg, true);
    }
    return;
  }

  const modal = document.getElementById("face-enroll-modal");
  const video = document.getElementById("face-video");

  try {
    faceStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = faceStream;
    modal.style.display = "flex";
    capturedFaceImage = "";
    stableStartTime = null;
    isSavingFace = false;
    autoCaptureCooldown = false;

    const scanLine = document.getElementById("scan-line");
    if (scanLine) scanLine.style.display = "block";

    setFaceEnrollMessage("Đưa khuôn mặt vào giữa khung tròn...");

    startAutoCaptureCheck();
  } catch (err) {
    console.error(err);
    setFaceEnrollMessage("Không mở được camera", true);
  }
}

function startAutoCaptureCheck() {
  stopAutoCaptureCheck();

  autoCaptureInterval = setInterval(async () => {
    if (isSavingFace || autoCaptureCooldown) return;

    const ready = await isFaceReadyForAutoCapture();

    if (!ready.ok) {
      stableStartTime = null;
      setFaceEnrollMessage(ready.message || "Đưa khuôn mặt vào giữa khung");
      return;
    }

    if (!stableStartTime) {
      stableStartTime = Date.now();
      setFaceEnrollMessage("Giữ yên khuôn mặt...");
      return;
    }

    const stableMs = Date.now() - stableStartTime;

    if (stableMs >= 1200) {
      autoCaptureCooldown = true;
      setFaceEnrollMessage("Đã nhận diện hợp lệ, đang tự lưu...");
      await autoCaptureAndSave();
    }
  }, 400);
}

function stopAutoCaptureCheck() {
  if (autoCaptureInterval) {
    clearInterval(autoCaptureInterval);
    autoCaptureInterval = null;
  }
}

async function isFaceReadyForAutoCapture() {
  const video = document.getElementById("face-video");
  if (!video) {
    return { ok: false, message: "Không tìm thấy camera" };
  }

  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { ok: false, message: "Đang khởi động camera..." };
  }

  // Bản nhẹ, chưa dùng detector thật:
  // kiểm tra video đã sẵn sàng + mặt người dùng có vẻ đã ổn định trong khung.
  // Sau này có thể thay bằng detector thật để chính xác hơn.
  return { ok: true, message: "Khuôn mặt hợp lệ" };
}

async function autoCaptureAndSave() {
  if (isSavingFace) return;

  isSavingFace = true;

  const ok = captureFaceImage();
  if (!ok || !capturedFaceImage) {
    isSavingFace = false;
    autoCaptureCooldown = false;
    setFaceEnrollMessage("Không chụp được ảnh", true);
    return;
  }

  await saveFaceImage();
}


function captureFaceImage() {
  const video = document.getElementById("face-video");
  const canvas = document.getElementById("face-canvas");

  if (!video || !canvas) return false;

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  capturedFaceImage = canvas.toDataURL("image/jpeg", 0.92);
  return true;
}

async function saveFaceImage() {
  const usernameInput = getActiveUsernameInput();
  const username = usernameInput ? usernameInput.value.trim() : "";

  if (!username) {
    isSavingFace = false;
    autoCaptureCooldown = false;
    setFaceEnrollMessage("Thiếu username", true);
    return;
  }

  if (!capturedFaceImage) {
    isSavingFace = false;
    autoCaptureCooldown = false;
    setFaceEnrollMessage("Chưa có ảnh khuôn mặt", true);
    return;
  }

  try {
    setFaceEnrollMessage("Đang lưu khuôn mặt...");

    const formData = new FormData();
    formData.append("username", username);
    formData.append("image", capturedFaceImage);

    const response = await fetch("ai/api/save_face.php", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      setFaceEnrollMessage("✅ Thiết lập FaceID thành công!");
      setFaceLoginMessage("✅ FaceID đã sẵn sàng", false);
      
      const scanLine = document.getElementById("scan-line");
      if (scanLine) scanLine.style.display = "none";

      setTimeout(() => {
        closeFaceEnrollModal();
      }, 1500);
    } else {
      isSavingFace = false;
      autoCaptureCooldown = false;
      stableStartTime = null;
      setFaceEnrollMessage(result.msg || result.error || "Không lưu được khuôn mặt", true);
    }
  } catch (err) {
    console.error(err);
    isSavingFace = false;
    autoCaptureCooldown = false;
    stableStartTime = null;
    setFaceEnrollMessage("Lỗi khi lưu khuôn mặt", true);
  }
}

function closeFaceEnrollModal() {
  stopAutoCaptureCheck();

  const modal = document.getElementById("face-enroll-modal");
  const video = document.getElementById("face-video");

  if (faceStream) {
    faceStream.getTracks().forEach(track => track.stop());
    faceStream = null;
  }

  if (video) {
    video.srcObject = null;
  }

  if (modal) {
    modal.style.display = "none";
  }

  const scanLine = document.getElementById("scan-line");
  if (scanLine) scanLine.style.display = "none";

  stableStartTime = null;
  isSavingFace = false;
  autoCaptureCooldown = false;
  capturedFaceImage = "";
}

  try {
    console.log("[FaceID Login] Starting for user:", username);
    const profileRes = await fetch("ai/api/get_face_profile.php?username=" + encodeURIComponent(username));
    const profileData = await profileRes.json();

    if (!profileData.success || !profileData.user) {
      setFaceLoginMessage("Không tìm thấy tài khoản", true);
      isFaceLoginActive = false;
      return;
    }

    if (!profileData.user.face_enabled || !profileData.user.face_image_url) {
      setFaceLoginMessage("Tài khoản chưa thiết lập khuôn mặt. Hãy bấm Thiết lập khuôn mặt trước.", true);
      isFaceLoginActive = false;
      return;
    }

    const faceImageUrl = profileData.user.face_image_url;
    const fullImageUrl = faceImageUrl.startsWith('http') ? faceImageUrl : window.location.origin + '/' + faceImageUrl.replace(/^\//, '');
    const lastSlash = fullImageUrl.lastIndexOf("/");
    const baseUrl = fullImageUrl.substring(0, lastSlash + 1);
    const fileName = fullImageUrl.substring(lastSlash + 1);

    console.log("[FaceID Login] Image metadata:", { baseUrl, fileName });
    setFaceLoginMessage("Đang mở camera để quét khuôn mặt...");

    aie_aic("body", {
      type: "fa",
      resolution: "qhd",
      option: {
        data_uri: baseUrl,
        data_label: [""],
        data_file: [fileName],
        liveness: true,
        deep_scan: true,
        deep_scan_button: true,
        liveness_action: "random(2)",
        liveness_action_random: ["faceLeft", "faceRight", "eyesBlink"],
        liveness_timeout: 5,
        draw_box: true,
        confidence: 0.5,
        scan_level: 0.45
      },
      brand: "Btoan AI",
      width: "100%",
      video: "all",
      mirror: false,
      mode: true,
      control: true,
      torch: true,
      exit: true,
      align: "top",
      opacity: 1,
      opacity_bg: "#222",
      zindex: 1000000,
      lang: {
        show: true,
        set: "vi"
      }
    }, async function (res, location) {
      isFaceLoginActive = false;
      console.log("[FaceID Login] AI Result:", res);
      
      try {
        const response = await fetch("ai/api/login_face.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "username=" + encodeURIComponent(username)
        });

        const result = await response.json();

        if (result.success) {
          localStorage.setItem("user_id", result.user_id);
          localStorage.setItem("username", result.username);
          localStorage.setItem("last_logged_in_username", result.username);
          setFaceLoginMessage("✅ Đăng nhập thành công! Đang chuyển hướng...");
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          setFaceLoginMessage("❌ " + (result.message || "Đăng nhập khuôn mặt thất bại"), true);
        }
      } catch (err) {
        console.error("[FaceID Login] Backend Error:", err);
        setFaceLoginMessage("Lỗi đăng nhập khuôn mặt", true);
      }
    });

  } catch (err) {
    console.error("[FaceID Login] Catch Error:", err);
    isFaceLoginActive = false;
    setFaceLoginMessage("Không kiểm tra được dữ liệu khuôn mặt", true);
  }
