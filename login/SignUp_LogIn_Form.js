const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => {
    container.classList.add('active');
})

loginBtn.addEventListener('click', () => {
    container.classList.remove('active');
})
function showRegister(){
  document.querySelector('.login').classList.remove('active');
  document.querySelector('.register').classList.add('active');
}

function showLogin(){
  document.querySelector('.register').classList.remove('active');
  document.querySelector('.login').classList.add('active');
}

/* Mặc định mobile mở login */
window.addEventListener("load", () => {
  if(window.innerWidth <= 768){
    document.querySelector('.login').classList.add('active');
    document.querySelector('.register').classList.remove('active');
  }
});