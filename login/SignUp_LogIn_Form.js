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
    const box = document.getElementById("authContainer")
    box.classList.add("active")
}

function showLogin(){
    const box = document.getElementById("authContainer")
    box.classList.remove("active")
}