import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  showMessage,
  setBusy,
  attachPasswordToggles
} from "./ui.js";


const form = document.getElementById("signupForm");
const message = document.getElementById("message");
const button = document.getElementById("submitBtn");

const normalButton = 'Create account <span>→</span>';

attachPasswordToggles();


form.addEventListener("submit", async (event) => {

  event.preventDefault();

  const name = document.getElementById("name")
    .value.trim();

  const email = document.getElementById("email")
    .value.trim().toLowerCase();

  const mobile = document.getElementById("mobile")
    .value.trim();

  const password = document.getElementById("password")
    .value;

  const confirmPassword = document.getElementById("confirmPassword")
    .value;


  // Validate name
  if (name.length < 2) {
    showMessage(message, "Please enter your full name.", "error");
    return;
  }


  // Validate email
  if (!email || !email.includes("@")) {
    showMessage(message, "Please enter a valid email address.", "error");
    return;
  }


  // Validate mobile number
  if (!/^\d{10}$/.test(mobile)) {
    showMessage(message, "Enter a valid 10-digit mobile number.", "error");
    return;
  }


  // Validate password
  if (password.length < 6) {
    showMessage(message, "Password must contain at least 6 characters.", "error");
    return;
  }


  // Confirm password
  if (password !== confirmPassword) {
    showMessage(message, "Passwords do not match.", "error");
    return;
  }


  setBusy(button, true, "Creating account...", normalButton);

  showMessage(message, "Checking email...");


  try {

    // Check whether email already exists
    const usersRef = collection(db, "Users");

    const emailQuery = query(
      usersRef,
      where("email", "==", email)
    );

    const existingUsers = await getDocs(emailQuery);


    if (!existingUsers.empty) {

      showMessage(
        message,
        "This email is already registered. Please sign in.",
        "error"
      );

      return;
    }


    // Create new customer
    const newUser = {
      userId: "USER-" + Date.now(),

      name: name,

      email: email,

      mobile: mobile,

      password: password,

      role: "customer",

      status: "active",

      creditLimit: 0,

      createdAt: serverTimestamp()
    };


    // Save to Firestore
    const documentRef = await addDoc(
      usersRef,
      newUser
    );


    console.log("Signup successful!");
    console.log("Document ID:", documentRef.id);


    showMessage(
      message,
      "Account created successfully! Redirecting to login...",
      "success"
    );


    form.reset();


    // Redirect to login
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);


  } catch (error) {

    console.error("Signup error:", error);

    showMessage(
      message,
      `Signup failed: ${error.message}`,
      "error"
    );

  } finally {

    setBusy(button, false, "Creating account...", normalButton);

  }

});