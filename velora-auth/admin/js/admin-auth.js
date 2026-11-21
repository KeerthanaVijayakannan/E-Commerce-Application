
document.addEventListener("DOMContentLoaded", () => {

    const currentPage = window.location.pathname.split("/").pop();
    const isLoginPage = currentPage === "admin-login.html";

    // Check admin session
    const isLoggedIn =
        sessionStorage.getItem("veloraAdmin") === "true" ||
        localStorage.getItem("adminLoggedIn") === "true" ||
        sessionStorage.getItem("adminLoggedIn") === "true";

    // Protect all admin pages
    if (!isLoginPage && !isLoggedIn) {
        window.location.replace("admin-login.html");
        return;
    }

    // LOGIN FORM
    const loginForm = document.getElementById("adminLoginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const email = document.getElementById("adminEmail").value.trim();
            const password = document.getElementById("adminPassword").value;
            const message = document.getElementById("loginMessage");
            const loginButton = document.getElementById("loginButton");

            // Temporary demo credentials
            const correctEmail = "admin@velora.com";
            const correctPassword = "Admin@123";

            if (email === correctEmail && password === correctPassword) {

                sessionStorage.setItem("veloraAdmin", "true");
                localStorage.setItem("adminLoggedIn", "true");

                message.style.color = "#39845b";
                message.textContent = "Login successful! Redirecting...";

                loginButton.disabled = true;
                loginButton.textContent = "Please wait...";

                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 500);

            } else {

                message.style.color = "#c04444";
                message.textContent = "Invalid email or password.";
            }
        });
    }

    // PASSWORD SHOW / HIDE
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("adminPassword");

    if (togglePassword && passwordInput) {

        togglePassword.addEventListener("click", () => {

            const isPassword = passwordInput.type === "password";

            passwordInput.type = isPassword ? "text" : "password";
            togglePassword.textContent = isPassword ? "Hide" : "Show";
        });
    }

});

// GLOBAL LOGOUT
window.adminLogout = function () {

    sessionStorage.removeItem("veloraAdmin");
    sessionStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminLoggedIn");

    window.location.replace("admin-login.html");
};
