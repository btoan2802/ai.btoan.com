document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');

  // ===== REGISTER =====
  window.showRegisterForm = function(){
    container.classList.add('active');
  }

  // ===== LOGIN =====
  window.showLoginForm = function(){
    container.classList.remove('active');
  }

  // ===== BUTTON PANEL (desktop panel xanh) =====
  if(registerBtn){
    registerBtn.addEventListener('click', showRegisterForm);
  }

  if(loginBtn){
    loginBtn.addEventListener('click', showLoginForm);
  }

  // ===== MOBILE DEFAULT (chỉ chạy 1 lần) =====
  if(window.innerWidth <= 768){
    container.classList.remove('active'); // mặc định login
  }

});