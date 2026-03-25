document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');

  function isMobile(){
    return window.innerWidth <= 768;
  }

  // ===== REGISTER =====
  window.showRegisterForm = function(){
    container.classList.add('active');
  }

  // ===== LOGIN =====
  window.showLoginForm = function(){
    container.classList.remove('active');
  }

  // ===== BUTTON PANEL =====
  if(registerBtn){
    registerBtn.onclick = showRegisterForm;
  }

  if(loginBtn){
    loginBtn.onclick = showLoginForm;
  }

  // ===== MOBILE DEFAULT =====
  function setupMobile(){
    if(isMobile()){
      container.classList.remove('active'); // mặc định login
    }
  }

  setupMobile();

  window.addEventListener("resize", setupMobile);

});