function isMobile(){
  return window.innerWidth <= 768;
}

function showRegister(){
  if(isMobile()){
    document.querySelector('.login').style.display = 'none';
    document.querySelector('.register').style.display = 'block';
  }else{
    document.querySelector('.container').classList.add('active');
  }
}

function showLogin(){
  if(isMobile()){
    document.querySelector('.login').style.display = 'block';
    document.querySelector('.register').style.display = 'none';
  }else{
    document.querySelector('.container').classList.remove('active');
  }
}

/* fix nút bên panel (desktop vẫn dùng) */
document.querySelector('.register-btn').onclick = showRegister;
document.querySelector('.login-btn').onclick = showLogin;

/* mặc định mobile */
window.addEventListener("load", () => {
  if(isMobile()){
    document.querySelector('.login').style.display = 'block';
    document.querySelector('.register').style.display = 'none';
  }
});