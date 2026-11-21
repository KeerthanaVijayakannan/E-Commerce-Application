export function showMessage(element, text, type = "") {
  element.textContent = text;
  element.className = type ? `message ${type}` : "message";
}
export function setBusy(button, busy, label, normalHtml) {
  button.disabled = busy;
  button.innerHTML = busy ? label : normalHtml;
}
export function attachPasswordToggles() {
  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggle;
      const input = document.getElementById(id);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
    });
  });
}
export function friendlyAuthError(code) {
  const messages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists with this email. Try signing in.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection and retry.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
    "auth/missing-email": "Please enter your email address.",
    "auth/user-disabled": "This account is disabled. Contact the store administrator."
  };
  return messages[code] || `Something went wrong (${code}). Please try again.`;
}
