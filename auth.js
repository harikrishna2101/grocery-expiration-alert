class Auth {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('users')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        const registerLink = document.getElementById('register-link');
        const logoutBtn = document.getElementById('logout-btn');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerLink) {
            registerLink.addEventListener('click', (e) => this.showRegisterForm(e));
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        this.updateUI();
    }

    handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const user = this.users.find(u => u.email === email && u.password === password);
        if (user) {
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.showNotification('Login successful!');
            window.location.href = 'products.html';
        } else {
            this.showNotification('Invalid credentials!', 'error');
        }
    }

    showRegisterForm(e) {
        e.preventDefault();
        const loginContainer = document.querySelector('.login-container');
        loginContainer.innerHTML = `
            <h2>Register</h2>
            <form id="register-form">
                <div class="form-group">
                    <label for="reg-name">Name:</label>
                    <input type="text" id="reg-name" required>
                </div>
                <div class="form-group">
                    <label for="reg-email">Email:</label>
                    <input type="email" id="reg-email" required>
                </div>
                <div class="form-group">
                    <label for="reg-password">Password:</label>
                    <input type="password" id="reg-password" required>
                </div>
                <button type="submit">Register</button>
            </form>
            <p>Already have an account? <a href="#" id="login-link">Login</a></p>
        `;

        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('login-link').addEventListener('click', (e) => this.showLoginForm(e));
    }

    showLoginForm(e) {
        e.preventDefault();
        const loginContainer = document.querySelector('.login-container');
        loginContainer.innerHTML = `
            <h2>Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            <p>Don't have an account? <a href="#" id="register-link">Register</a></p>
        `;

        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-link').addEventListener('click', (e) => this.showRegisterForm(e));
    }

    handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        if (this.users.some(u => u.email === email)) {
            this.showNotification('Email already exists!', 'error');
            return;
        }

        const newUser = { name, email, password };
        this.users.push(newUser);
        localStorage.setItem('users', JSON.stringify(this.users));
        this.showNotification('Registration successful! Please login.');
        this.showLoginForm(e);
    }

    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showNotification('Logged out successfully!');
        window.location.href = 'index.html';
    }

    updateUI() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.style.display = this.currentUser ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    isAuthenticated() {
        return !!this.currentUser;
    }
}

const auth = new Auth(); 