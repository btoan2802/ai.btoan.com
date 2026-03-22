// ===== SAFE READY =====
document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
  const loginBox = document.querySelector('.login');
  const registerBox = document.querySelector('.register');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');

  function isMobile(){
    return window.innerWidth <= 768;
  }

  // ===== SHOW REGISTER =====
  window.showRegisterForm = function(){
    if(!loginBox || !registerBox) return;

    if(isMobile()){
      loginBox.style.display = 'none';
      registerBox.style.display = 'block';
    }else{
      container.classList.add('active');
    }
  }

  // ===== SHOW LOGIN =====
  window.showLoginForm = function(){
    if(!loginBox || !registerBox) return;

    if(isMobile()){
      loginBox.style.display = 'block';
      registerBox.style.display = 'none';
    }else{
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
    if(!loginBox || !registerBox) return;

    if(isMobile()){
      loginBox.style.display = 'block';
      registerBox.style.display = 'none';
    }else{
      loginBox.style.display = '';
      registerBox.style.display = '';
    }
  }

  setupMobile();

  // ===== FIX XOAY MÀN HÌNH =====
  window.addEventListener("resize", setupMobile);

});