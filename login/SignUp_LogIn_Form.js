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
  container.classList.remove('active');
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




const faceEnrollBtnProfile = document.getElementById("face-enroll-btn-profile");

if (faceEnrollBtnProfile) {
  faceEnrollBtnProfile.addEventListener("click", openFaceEnrollModal);
}

// Face Login button
const faceLoginBtn = document.getElementById("face-login-btn");
if (faceLoginBtn) {
  faceLoginBtn.addEventListener("click", loginWithFace);
}

// Face Close button
const faceCloseBtn = document.getElementById("face-close-btn");
if (faceCloseBtn) {
  faceCloseBtn.addEventListener("click", closeFaceEnrollModal);
}

let isAiReady = false;

// Initialize Face-API
async function initFaceAI() {
  try {
    const MODEL_URL = "facelib/models";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    isAiReady = true;
    console.log("[FaceAI] Models loaded successfully");
  } catch (err) {
    console.error("[FaceAI] Error loading models:", err);
  }
}

// Start loading models immediately
initFaceAI();

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
  el.style.color = isError ? "#ef4444" : "#10b981";
}

function setFaceEnrollMessage(message, isError = false) {
  const el = document.getElementById("face-enroll-status");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ef4444" : "#10b981";
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
  if (!isAiReady) {
      alert("Hệ thống AI đang khởi tạo, vui lòng đợi vài giây...");
      return;
  }

  // Use logged in username if profile modal is open
  const isLoggedIn = document.getElementById("chatApp").style.display !== "none";
  let username = "";
  
  if (isLoggedIn) {
      username = localStorage.getItem("username") || "";
  } else {
      const usernameInput = getActiveUsernameInput();
      username = usernameInput ? usernameInput.value.trim() : "";
  }

  if (!username) {
    const isReg = document.getElementById('registerForm')?.classList.contains('active');
    const msg = isReg ? "Vui lòng nhập tên đăng ký trước" : "Vui lòng nhập username trước";
    if (isLoggedIn) {
        alert(msg);
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

    setFaceEnrollMessage("AI đang sẵn sàng, vui lòng nhìn thẳng...");

    startAutoCaptureCheck();
  } catch (err) {
    console.error(err);
    setFaceEnrollMessage("Cần cấp quyền Camera để dùng FaceID", true);
  }
}

function startAutoCaptureCheck() {
  stopAutoCaptureCheck();

  autoCaptureInterval = setInterval(async () => {
    if (isSavingFace || autoCaptureCooldown) return;

    const video = document.getElementById("face-video");
    if (!video || video.readyState < 2) return;

    // REAL FACE DETECTION
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                                   .withFaceLandmarks();

    if (!detection) {
      stableStartTime = null;
      setFaceEnrollMessage("Hãy đưa khuôn mặt vào giữa khung tròn");
      return;
    }

    if (!stableStartTime) {
      stableStartTime = Date.now();
      setFaceEnrollMessage("Đã nhận diện khuôn mặt, giữ yên...");
      return;
    }

    const stableMs = Date.now() - stableStartTime;

    if (stableMs >= 1000) {
      autoCaptureCooldown = true;
      setFaceEnrollMessage("✅ Hợp lệ! Đang lưu khuôn mặt...");
      await autoCaptureAndSave();
    }
  }, 300);
}

function stopAutoCaptureCheck() {
  if (autoCaptureInterval) {
    clearInterval(autoCaptureInterval);
    autoCaptureInterval = null;
  }
}

let capturedDescriptor = null;

async function autoCaptureAndSave() {
  if (isSavingFace) return;
  isSavingFace = true;

  const video = document.getElementById("face-video");
  const canvas = document.getElementById("face-canvas");

  if (!video || !canvas) return;

  // 🧠 COMPUTE DESCRIPTOR FOR STORAGE
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                                 .withFaceLandmarks()
                                 .withFaceDescriptor();

  if (!detection) {
      isSavingFace = false;
      autoCaptureCooldown = false;
      setFaceEnrollMessage("❌ Không thể lấy mã khuôn mặt, thử lại...", true);
      return;
  }
  
  capturedDescriptor = JSON.stringify(Array.from(detection.descriptor));

  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  capturedFaceImage = canvas.toDataURL("image/jpeg", 0.9);
  await saveFaceImage();
}

async function saveFaceImage() {
  let username = "";
  const isLoggedIn = document.getElementById("chatApp").style.display !== "none";

  if (isLoggedIn) {
      username = localStorage.getItem("username") || "";
  } else {
      const usernameInput = getActiveUsernameInput();
      username = usernameInput ? usernameInput.value.trim() : "";
  }

  if (!username || !capturedDescriptor) {
    isSavingFace = false;
    autoCaptureCooldown = false;
    setFaceEnrollMessage("Thiếu dữ liệu", true);
    return;
  }

  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("image", capturedFaceImage);
    formData.append("descriptor", capturedDescriptor); // 🔒 Biometric reference

    const response = await fetch("ai/api/save_face.php", {
      method: "POST",
      body: formData
    });


    const result = await response.json();

    if (result.success) {
      setFaceEnrollMessage("✅ Đã lưu khuôn mặt thành công!");
      setTimeout(() => closeFaceEnrollModal(), 1500);
    } else {
      isSavingFace = false;
      autoCaptureCooldown = false;
      setFaceEnrollMessage(result.message || "Lỗi khi lưu ảnh", true);
    }
  } catch (err) {
    console.error(err);
    isSavingFace = false;
    autoCaptureCooldown = false;
    setFaceEnrollMessage("Lỗi kết nối máy chủ", true);
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
  if (video) video.srcObject = null;
  if (modal) modal.style.display = "none";
  isSavingFace = false;
  autoCaptureCooldown = false;
}

async function loginWithFace() {
  if (isFaceLoginActive) return;
  if (!isAiReady) {
      setFaceLoginMessage("AI đang khởi động, vui lòng đợi...", true);
      return;
  }

  const usernameInput = getActiveUsernameInput();
  const username = usernameInput ? usernameInput.value.trim() : "";

  if (!username) {
    setFaceLoginMessage("Vui lòng nhập username trước", true);
    return;
  }

  try {
    isFaceLoginActive = true;
    setFaceLoginMessage("Đang khởi động camera...");

    const modal = document.getElementById("face-enroll-modal");
    const video = document.getElementById("face-video");

    faceStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = faceStream;
    modal.style.display = "flex";
    
    const scanLine = document.getElementById("scan-line");
    if (scanLine) scanLine.style.display = "block";

    setFaceEnrollMessage("🔍 Đang xác minh danh tính...");

    // 1. Fetch reference image/profile
    const res = await fetch("ai/api/get_face_profile.php?username=" + encodeURIComponent(username));
    const data = await res.json();

    if (!data.success || !data.user || !data.user.face_image_url) {
      setFaceEnrollMessage("Tài khoản chưa có dữ liệu FaceID", true);
      setTimeout(() => closeFaceEnrollModal(), 2000);
      isFaceLoginActive = false;
      return;
    }

    // 2. Load Reference Face
    const refImg = await faceapi.fetchImage(data.user.face_image_url);
    const refDetection = await faceapi.detectSingleFace(refImg, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (!refDetection) {
      setFaceEnrollMessage("❌ Dữ liệu mẫu bị lỗi, hãy thiết lập lại", true);
      setTimeout(() => closeFaceEnrollModal(), 2000);
      isFaceLoginActive = false;
      return;
    }

    const faceMatcher = new faceapi.FaceMatcher(refDetection);

    // 3. Compare with Live Stream
    const loop = setInterval(async () => {
        if (!isFaceLoginActive) { clearInterval(loop); return; }

        const liveDetection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                                       .withFaceLandmarks()
                                       .withFaceDescriptor();
        
        if (liveDetection) {
            setFaceEnrollMessage("🔍 Đang truyền dữ liệu xác thực...");
            
            // 🔒 BACKEND VERIFICATION ONLY
            const formData = new FormData();
            formData.append("username", username);
            formData.append("descriptor", JSON.stringify(Array.from(liveDetection.descriptor)));

            try {
                const loginRes = await fetch("ai/api/login_face.php", { method: "POST", body: formData });
                const loginData = await loginRes.json();

                if (loginData.success) {
                    clearInterval(loop);
                    setFaceEnrollMessage("✅ Xác thực thành công! Đang vào hệ thống...");
                    localStorage.setItem("user_id", loginData.user_id);
                    localStorage.setItem("username", loginData.username);
                    localStorage.setItem("last_logged_in_username", loginData.username);
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    // Fail from server (Distance too high or user not found)
                    setFaceEnrollMessage("❌ " + loginData.message, true);
                }
            } catch (e) {
                console.error("Auth error:", e);
                setFaceEnrollMessage("Lỗi kết nối xác thực", true);
            }
        } else {
            setFaceEnrollMessage("Đưa khuôn mặt vào giữa khung");
        }
    }, 1000); // 1s sync interval


    // Timeout after 20s
    setTimeout(() => { if (isFaceLoginActive) { clearInterval(loop); setFaceEnrollMessage("Hết thời gian chờ", true); isFaceLoginActive = false; }}, 20000);

  } catch (err) {
    console.error(err);
    setFaceLoginMessage("Lỗi khởi động FaceID", true);
    isFaceLoginActive = false;
  }
}

document.addEventListener("click", (e) => {
    // Listener logic
});

}); // END DOMContentLoaded
