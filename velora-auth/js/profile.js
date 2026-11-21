// Get logged-in user
const loggedInUser = JSON.parse(
    sessionStorage.getItem("veloraUser") || "null"
);

// Protect profile page
if (!loggedInUser) {
    window.location.href = "login.html";
} else {

    // Display user information
    document.getElementById("profileName").textContent =
        loggedInUser.name || "Customer";

    document.getElementById("profileEmail").textContent =
        loggedInUser.email || "—";

    document.getElementById("detailName").textContent =
        loggedInUser.name || "—";

    document.getElementById("detailEmail").textContent =
        loggedInUser.email || "—";

    document.getElementById("detailUserId").textContent =
        loggedInUser.userId || "—";

    document.getElementById("detailRole").textContent =
        loggedInUser.role || "Customer";

    // Set avatar initial
    document.getElementById("profileAvatar").textContent =
        (loggedInUser.name || "V").charAt(0).toUpperCase();
}


// Logout
document.getElementById("logoutButton").addEventListener("click", () => {

    sessionStorage.removeItem("veloraUser");

    alert("You have been logged out.");

    window.location.href = "login.html";

});