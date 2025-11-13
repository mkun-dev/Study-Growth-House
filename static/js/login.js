const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'pet123';
const ADMIN_AUTH_KEY = 'admin_auth_token';
const ADMIN_AUTH_VALUE = 'granted';

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem(ADMIN_AUTH_KEY) === ADMIN_AUTH_VALUE) {
        window.location.href = 'admin.html';
        return;
    }

    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('admin-login-btn');
    const errorBox = document.getElementById('login-error');

    function handleLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            localStorage.setItem(ADMIN_AUTH_KEY, ADMIN_AUTH_VALUE);
            window.location.href = 'admin.html';
        } else {
            errorBox.textContent = '账号或密码错误，请重新输入。';
        }
    }

    loginBtn.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
});
