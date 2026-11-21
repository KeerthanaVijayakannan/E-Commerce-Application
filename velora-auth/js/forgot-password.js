import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { showMessage, setBusy, attachPasswordToggles } from "./ui.js";

const form = document.getElementById("resetForm");
const message = document.getElementById("message");
const button = document.getElementById("submitBtn");
const normalButton = 'Update password <span>→</span>';
attachPasswordToggles();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (password.length < 6) { showMessage(message, "Password must be at least 6 characters.", "error"); return; }
  if (password !== confirmPassword) { showMessage(message, "New password and confirmation do not match.", "error"); return; }
  setBusy(button, true, "Updating…", normalButton);
  showMessage(message, "Finding your account…");
  try {
    const result = await getDocs(query(collection(db, "Users"), where("email", "==", email)));
    if (result.empty) { showMessage(message, "No account was found with that email address.", "error"); return; }
    if (result.size > 1) { showMessage(message, "More than one record uses this email. Please contact the administrator.", "error"); return; }
    const userDoc = result.docs[0];
    const data = userDoc.data();
    if (data.status && data.status.toLowerCase() !== "active") { showMessage(message, "This account is inactive. Please contact the administrator.", "error"); return; }
    await updateDoc(userDoc.ref, { password });
    showMessage(message, "Password updated successfully! You can now sign in using your new password.", "success");
    form.reset();
  } catch (error) {
    console.error("Password update error:", error);
    showMessage(message, `Could not update password (${error.code || error.message}). Check Firestore rules.`, "error");
  } finally {
    setBusy(button, false, "Updating…", normalButton);
  }
});
