document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector('.container');
  const registerBtn = document.querySelector('.register-btn');
  const loginBtn = document.querySelector('.login-btn');

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