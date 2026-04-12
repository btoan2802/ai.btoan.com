// ===== SAFE READY =====
document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
const loginBox = document.getElementById('loginForm');
const registerBox = document.getElementById('registerForm');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');
loginBox.classList.add('active');
  function isMobile(){
    return window.innerWidth <= 768;
  }

window.showRegisterForm = function(){

  if(window.innerWidth <= 768){
    // MOBILE
    registerBox.classList.add('active');
    loginBox.classList.remove('active');
  }else{
    // DESKTOP
    container.classList.add('active');
  }

}

window.showLoginForm = function(){

  if(window.innerWidth <= 768){
    // MOBILE
    loginBox.classList.add('active');
    registerBox.classList.remove('active');
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
const faceCaptureBtn = document.getElementById("face-capture-btn");
const faceSaveBtn = document.getElementById("face-save-btn");
const faceCloseBtn = document.getElementById("face-close-btn");

if (faceLoginBtn) {
  faceLoginBtn.addEventListener("click", loginWithFace);
}

if (faceEnrollBtn) {
  faceEnrollBtn.addEventListener("click", openFaceEnrollModal);
}

if (faceCaptureBtn) {
  faceCaptureBtn.addEventListener("click", captureFaceImage);
}

if (faceSaveBtn) {
  faceSaveBtn.addEventListener("click", saveFaceImage);
}

if (faceCloseBtn) {
  faceCloseBtn.addEventListener("click", closeFaceEnrollModal);
}

});

let faceStream = null;
let capturedFaceImage = "";

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

function getLoginUsernameInput() {
  return document.getElementById("login_username")
    || document.getElementById("username")
    || document.querySelector('input[name="username"]')
    || document.querySelector('input[type="text"]');
}

async function openFaceEnrollModal() {
  const usernameInput = getLoginUsernameInput();
  if (!usernameInput || !usernameInput.value.trim()) {
    setFaceLoginMessage("Vui lòng nhập username trước khi thiết lập khuôn mặt", true);
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
    setFaceEnrollMessage("Đưa mặt vào giữa khung rồi bấm Chụp ảnh");
  } catch (err) {
    console.error(err);
    setFaceEnrollMessage("Không mở được camera", true);
  }
}

function captureFaceImage() {
  const video = document.getElementById("face-video");
  const canvas = document.getElementById("face-canvas");

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  capturedFaceImage = canvas.toDataURL("image/jpeg", 0.92);
  setFaceEnrollMessage("Đã chụp ảnh. Bấm Lưu khuôn mặt để hoàn tất.");
}

async function saveFaceImage() {
  const usernameInput = getLoginUsernameInput();
  const username = usernameInput ? usernameInput.value.trim() : "";

  if (!username) {
    setFaceEnrollMessage("Thiếu username", true);
    return;
  }

  if (!capturedFaceImage) {
    setFaceEnrollMessage("Bạn chưa chụp ảnh", true);
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
      setFaceEnrollMessage("Thiết lập khuôn mặt thành công");
      setFaceLoginMessage("Tài khoản đã sẵn sàng đăng nhập bằng khuôn mặt");
      closeFaceEnrollModal();
    } else {
      setFaceEnrollMessage(result.msg || result.error || "Không lưu được khuôn mặt", true);
    }
  } catch (err) {
    console.error(err);
    setFaceEnrollMessage("Lỗi khi lưu khuôn mặt", true);
  }
}

function closeFaceEnrollModal() {
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
}

async function loginWithFace() {
  const usernameInput = getLoginUsernameInput();
  const username = usernameInput ? usernameInput.value.trim() : "";

  if (!username) {
    setFaceLoginMessage("Vui lòng nhập username trước", true);
    return;
  }

  if (typeof aie_aic !== "function") {
    setFaceLoginMessage("Chưa tải xong thư viện nhận diện khuôn mặt", true);
    return;
  }

  try {
    const profileRes = await fetch("ai/api/get_face_profile.php?username=" + encodeURIComponent(username));
    const profileData = await profileRes.json();

    if (!profileData.success || !profileData.user) {
      setFaceLoginMessage("Không tìm thấy tài khoản", true);
      return;
    }

    if (!profileData.user.face_enabled || !profileData.user.face_image_url) {
      setFaceLoginMessage("Tài khoản chưa thiết lập khuôn mặt. Hãy bấm Thiết lập khuôn mặt trước.", true);
      return;
    }

    const faceImageUrl = profileData.user.face_image_url;
    const lastSlash = faceImageUrl.lastIndexOf("/");
    const baseUrl = faceImageUrl.substring(0, lastSlash + 1);
    const fileName = faceImageUrl.substring(lastSlash + 1);

    setFaceLoginMessage("Đang mở camera để quét khuôn mặt...");

    aie_aic("body", {
      type: "fa",
      option: {
        data_uri: baseUrl,
        data_label: [""],
        data_file: [fileName],
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
      zindex: 1999999999,
      lang: {
        show: true,
        set: "vi"
      }
    }, async function (res, location) {
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
          setFaceLoginMessage("Đăng nhập thành công");
          window.location.reload();
        } else {
          setFaceLoginMessage(result.message || "Đăng nhập khuôn mặt thất bại", true);
        }
      } catch (err) {
        console.error(err);
        setFaceLoginMessage("Lỗi đăng nhập khuôn mặt", true);
      }
    });

  } catch (err) {
    console.error(err);
    setFaceLoginMessage("Không kiểm tra được dữ liệu khuôn mặt", true);
  }
}