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

});

function setFaceLoginMessage(message, isError = false) {
    const el = document.getElementById("face-login-status");
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "red" : "green";
}

function extractFaceMatch(res) {
    if (!Array.isArray(res) || res.length === 0) return null;

    const first = res[0] || {};

    return {
        label:
            first.label ||
            first.name ||
            first.id ||
            first.identity ||
            "",
        score:
            first.score ??
            first.confidence ??
            first.accuracy ??
            0
    };
}

async function finalizeFaceLogin(username, faceLabel) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("face_label", faceLabel);

    const response = await fetch("ai/api/login_face.php", {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    return data;
}

function loginWithFace() {
    const usernameInput =
        document.querySelector('input[name="username"], #username, input[type="text"]');

    if (!usernameInput) {
        setFaceLoginMessage("Không tìm thấy ô username", true);
        return;
    }

    const username = usernameInput.value.trim();

    if (!username) {
        setFaceLoginMessage("Vui lòng nhập username trước", true);
        return;
    }

    if (typeof aie_aic !== "function") {
        setFaceLoginMessage("Chưa tải xong thư viện nhận diện khuôn mặt", true);
        return;
    }

    setFaceLoginMessage("Đang mở camera để quét khuôn mặt...");

    aie_aic("body", {
        type: "fa",
        option: {
            data_uri: "/face-data/",
            data_label: [username],
            data_file: ["1.jpg"],
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
        const match = extractFaceMatch(res);

        if (!match || !match.label) {
            setFaceLoginMessage("Không nhận diện được khuôn mặt phù hợp", true);
            return;
        }

        try {
            setFaceLoginMessage("Đã nhận diện: " + match.label + ". Đang đăng nhập...");

            const loginResult = await finalizeFaceLogin(username, match.label);

            if (loginResult.success) {
                setFaceLoginMessage("Đăng nhập thành công");
                window.location.reload();
            } else {
                setFaceLoginMessage(loginResult.message || "Đăng nhập khuôn mặt thất bại", true);
            }
        } catch (err) {
            setFaceLoginMessage("Lỗi đăng nhập khuôn mặt", true);
            console.error(err);
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const faceBtn = document.getElementById("face-login-btn");
    if (faceBtn) {
        faceBtn.addEventListener("click", loginWithFace);
    }
});