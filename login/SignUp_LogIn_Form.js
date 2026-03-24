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
  registerBox.classList.add('active');
  loginBox.classList.remove('active');
}

window.showLoginForm = function(){
  loginBox.classList.add('active');
  registerBox.classList.remove('active');
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