import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  showMessage,
  setBusy,
  attachPasswordToggles
} from "./ui.js";


const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const button = document.getElementById("submitBtn");

const normalButton = 'Sign in <span>→</span>';

const FIRESTORE_BASE =
  "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents";

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";


attachPasswordToggles();


// Sync guest cart into Firestore after customer login
async function syncCartToFirestore(loggedInUser) {

  if (loggedInUser.role === "admin") {
    return;
  }

  const localCart = JSON.parse(
    localStorage.getItem("veloraCart") || "[]"
  );

  if (localCart.length === 0) {
    console.log("Guest cart is empty. Nothing to sync.");
    return;
  }

  const cartDocumentId = loggedInUser.userId;

  const cartURL =
    `${FIRESTORE_BASE}/Carts/${encodeURIComponent(cartDocumentId)}?key=${API_KEY}`;

  // Get existing cart document, if available
  let existingCart = [];
  let documentExists = false;

  const getResponse = await fetch(cartURL);

  if (getResponse.ok) {

    documentExists = true;

    const existingData = await getResponse.json();

    const cartArray =
      existingData.fields?.cartItems?.arrayValue?.values || [];

    existingCart = cartArray.map(item => ({
      productId: item.mapValue.fields.productId.stringValue,
      quantity: Number(
        item.mapValue.fields.quantity.integerValue || 0
      )
    }));

  } else if (getResponse.status !== 404) {

    throw new Error("Unable to read existing Firestore cart.");

  }


  // Merge guest cart and existing Firestore cart
  const mergedCart = [...existingCart];

  localCart.forEach(localItem => {

    const existingItem = mergedCart.find(
      item => item.productId === localItem.productId
    );

    if (existingItem) {
    existingItem.quantity = Math.max(
        existingItem.quantity,
        Number(localItem.quantity)
    );
} else {
    mergedCart.push({
        productId: localItem.productId,
        quantity: Number(localItem.quantity)
    });
}
  });


  // Convert cart into Firestore REST format
  const cartFields = {
    userId: {
      stringValue: loggedInUser.userId
    },
    documentId: {
      stringValue: loggedInUser.documentId
    },
    name: {
      stringValue: loggedInUser.name
    },
    email: {
      stringValue: loggedInUser.email
    },
    cartItems: {
      arrayValue: {
        values: mergedCart.map(item => ({
          mapValue: {
            fields: {
              productId: {
                stringValue: item.productId
              },
              quantity: {
                integerValue: String(item.quantity)
              }
            }
          }
        }))
      }
    },
    updatedAt: {
      timestampValue: new Date().toISOString()
    }
  };


  const saveURL = documentExists
    ? cartURL
    : `${FIRESTORE_BASE}/Carts?documentId=${encodeURIComponent(cartDocumentId)}&key=${API_KEY}`;


  const saveResponse = await fetch(saveURL, {
    method: documentExists ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: cartFields
    })
  });


  if (!saveResponse.ok) {
    const errorData = await saveResponse.json();
    console.error("Firestore cart sync error:", errorData);
    throw new Error("Unable to save cart to Firestore.");
  }


  // Keep the merged cart in the browser too
  localStorage.setItem(
    "veloraCart",
    JSON.stringify(mergedCart)
  );

  console.log("Cart synced successfully to Firestore:", mergedCart);
}


// Login form
form.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = document.getElementById("email")
    .value.trim().toLowerCase();

  const password = document.getElementById("password")
    .value;

  if (!email || !password) {
    showMessage(message, "Please enter email and password.", "error");
    return;
  }

  setBusy(button, true, "Checking...", normalButton);

  showMessage(message, "Checking your account...");

  try {

    // Find user by email
    const usersRef = collection(db, "Users");

    const q = query(
      usersRef,
      where("email", "==", email)
    );

    const snapshot = await getDocs(q);

    console.log("Users found:", snapshot.size);

    if (snapshot.empty) {
      showMessage(message, "Email not found. Please sign up.", "error");
      return;
    }

    // Check entered password
    const matchingUser = snapshot.docs.find((doc) => {
      return doc.data().password === password;
    });

    if (!matchingUser) {
      showMessage(message, "Incorrect password.", "error");
      return;
    }

    const userData = matchingUser.data();

    // Check account status
    if (
      userData.status &&
      userData.status.toLowerCase() !== "active"
    ) {
      showMessage(
        message,
        "Your account is inactive. Contact administrator.",
        "error"
      );
      return;
    }

    // Store login session
    const loggedInUser = {
      documentId: matchingUser.id,
      userId: userData.userId || matchingUser.id,
      name: userData.name || "",
      email: userData.email,
      role: userData.role || "customer"
    };

    sessionStorage.setItem(
      "veloraUser",
      JSON.stringify(loggedInUser)
    );

    console.log("Login successful:", loggedInUser);


    // Sync cart to Firestore
    try {

      await syncCartToFirestore(loggedInUser);

      console.log("Cart sync complete.");

    } catch (cartError) {

      console.error("Cart sync failed:", cartError);

      showMessage(
        message,
        "Login successful, but cart sync failed. Check console.",
        "error"
      );

    }


    if (loggedInUser.role !== "admin") {

      showMessage(
        message,
        `Login successful! Welcome, ${loggedInUser.name}.`,
        "success"
      );

    } else {

      showMessage(
        message,
        "Admin login successful!",
        "success"
      );

    }


    // Redirect after successful login
   setTimeout(() => {

    if (loggedInUser.role === "admin") {
        window.location.href = "admin-dashboard.html";
    } else {
        window.location.href = "customer-profile.html";
    }

}, 1000);


  } catch (error) {

    console.error("Login error:", error);

    showMessage(
      message,
      `Login failed: ${error.message}`,
      "error"
    );

  } finally {

    setBusy(button, false, "Checking...", normalButton);

  }

});