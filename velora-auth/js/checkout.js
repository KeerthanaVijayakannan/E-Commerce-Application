const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const FIRESTORE_URL =
    `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

const user = JSON.parse(sessionStorage.getItem("veloraUser"));

if (!user) {
    alert("Please login to continue checkout.");
    window.location.href = "login.html";
}

const cart = JSON.parse(localStorage.getItem("veloraCart")) || [];

const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutShipping = document.getElementById("checkoutShipping");
const checkoutTotal = document.getElementById("checkoutTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");

let subtotal = 0;
let shipping = 0;
let total = 0;
let products = [];

// Fetch products from Firestore
async function fetchProducts() {
    try {
        const response = await fetch(
            `${FIRESTORE_URL}/Products?key=${API_KEY}`
        );

        const data = await response.json();

        products = (data.documents || []).map(doc => ({
            id: doc.name.split("/").pop(),
            ...Object.fromEntries(
                Object.entries(doc.fields || {}).map(([key, value]) => [
                    key,
                    value.stringValue ||
                    value.integerValue ||
                    value.doubleValue ||
                    value.booleanValue
                ])
            )
        }));

        renderCheckout();
    } catch (error) {
        console.error("Error fetching products:", error);
        checkoutItems.innerHTML = "<p>Unable to load products.</p>";
    }
}

// Display cart items
function renderCheckout() {
    checkoutItems.innerHTML = "";
    subtotal = 0;

    if (cart.length === 0) {
        checkoutItems.innerHTML = "<p>Your cart is empty.</p>";
        placeOrderBtn.disabled = true;
        return;
    }

    cart.forEach(cartItem => {
        const product = products.find(
            p => p.id === cartItem.productId
        );

        if (!product) return;

        const price = Number(product.price) || 0;
        const quantity = Number(cartItem.quantity) || 1;
        const itemTotal = price * quantity;

        subtotal += itemTotal;

        checkoutItems.innerHTML += `
            <div class="checkout-item">
                <div class="checkout-item-info">
                    <h3>${product.name}</h3>
                    <p>Qty: ${quantity}</p>
                </div>
                <div class="checkout-item-price">
                    ₹${itemTotal.toLocaleString("en-IN")}
                </div>
            </div>
        `;
    });

    shipping = subtotal >= 999 ? 0 : 50;
    total = subtotal + shipping;

    checkoutSubtotal.textContent = `₹${subtotal.toLocaleString("en-IN")}`;
    checkoutShipping.textContent =
        shipping === 0 ? "FREE" : `₹${shipping}`;
    checkoutTotal.textContent = `₹${total.toLocaleString("en-IN")}`;

    placeOrderBtn.disabled = false;
}

// Save delivery address
// Save delivery address to Firestore
document.getElementById("addressForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const address = {
        fullName: document.getElementById("fullName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        addressLine: document.getElementById("addressLine").value.trim(),
        landmark: document.getElementById("landmark").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: document.getElementById("state").value.trim(),
        pincode: document.getElementById("pincode").value.trim(),
        addressType: document.getElementById("addressType").value,
        userId: user.userId,
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(
            `${FIRESTORE_URL}/Addresses?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fields: {
                        userId: { stringValue: address.userId },
                        fullName: { stringValue: address.fullName },
                        phone: { stringValue: address.phone },
                        addressLine: { stringValue: address.addressLine },
                        landmark: { stringValue: address.landmark },
                        city: { stringValue: address.city },
                        state: { stringValue: address.state },
                        pincode: { stringValue: address.pincode },
                        addressType: { stringValue: address.addressType },
                        createdAt: { stringValue: address.createdAt }
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error("Failed to save address");
        }

        const savedAddress = await response.json();

        sessionStorage.setItem(
            "veloraCheckoutAddress",
            JSON.stringify({
                ...address,
                documentId: savedAddress.name.split("/").pop()
            })
        );

        alert("Delivery address saved successfully!");
        placeOrderBtn.disabled = false;

    } catch (error) {
        console.error("Address save error:", error);
        alert("Unable to save address. Please try again.");
    }
});

// Continue to payment
placeOrderBtn.addEventListener("click", function () {
    const address = sessionStorage.getItem("veloraCheckoutAddress");

    if (!address) {
        alert("Please save your delivery address first.");
        return;
    }

    alert("Delivery address confirmed! Payment step will be added next.");
});

fetchProducts();