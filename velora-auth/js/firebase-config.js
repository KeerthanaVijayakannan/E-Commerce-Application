// Firebase client configuration for this prototype.
// Do not add service-account or Admin SDK secrets to frontend files.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M",
  authDomain: "e-commerce-b63d7.firebaseapp.com",
  projectId: "e-commerce-b63d7",
  storageBucket: "e-commerce-b63d7.firebasestorage.app",
  messagingSenderId: "679123882838",
  appId: "1:679123882838:web:0c2dc648e21d969cfa7cf7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
