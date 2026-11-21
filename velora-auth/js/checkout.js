const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const FIRESTORE_URL =
    `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

const user = JSON.parse(sessionStorage.getItem("veloraUser"));

const cart = JSON.parse(localStorage.getItem("veloraCart")) || [];

const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutShipping = document.getElementById("checkoutShipping");
const checkoutTotal = document.getElementById("checkoutTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const addressForm = document.getElementById("addressForm");

let subtotal = 0;
let shipping = 0;
let total = 0;
let products = [];

// Convert Firestore REST field values
function decodeFirestoreValue(value) {
    if (!value) return "";

    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;

    if (value.nullValue !== undefined) return null;

    if (value.mapValue) {
        return decodeFirestoreFields(value.mapValue.fields || {});
    }

    if (value.arrayValue) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }

    return "";
}

function decodeFirestoreFields(fields) {
    const result = {};

    Object.entries(fields || {}).forEach(([key, value]) => {
        result[key] = decodeFirestoreValue(value);
    });

    return result;
}

// Safely display text in HTML
function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Find a product field even if its name has different casing
function getProductField(product, possibleNames) {
    for (const possibleName of possibleNames) {
        const actualKey = Object.keys(product).find(
            key => key.toLowerCase() === possibleName.toLowerCase()
        );

        if (actualKey !== undefined) {
            const value = product[actualKey];

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== "" &&
                String(value).toLowerCase() !== "undefined" &&
                String(value).toLowerCase() !== "null"
            ) {
                return value;
            }
        }
    }

    return null;
}

// Fetch products from Firestore
async function fetchProducts() {
    try {
        const response = await fetch(
            `${FIRESTORE_URL}/Products?key=${API_KEY}`
        );

        if (!response.ok) {
            throw new Error("Unable to fetch products from Firestore");
        }

        const data = await response.json();

        products = (data.documents || []).map(doc => ({
            id: doc.name.split("/").pop(),
            ...decodeFirestoreFields(doc.fields || {})
        }));

        console.log("Checkout products:", products);

        renderCheckout();

    } catch (error) {
        console.error("Error fetching products:", error);
        checkoutItems.innerHTML =
            `<p class="cart-error">Unable to load products. Please refresh.</p>`;
        placeOrderBtn.disabled = true;
    }
}

// Display checkout products and calculate totals
function renderCheckout() {
    checkoutItems.innerHTML = "";
    subtotal = 0;

    if (cart.length === 0) {
        checkoutItems.innerHTML = "<p>Your cart is empty.</p>";
        placeOrderBtn.disabled = true;
        return;
    }

    let missingProducts = false;

    cart.forEach(cartItem => {
        const product = products.find(
            p => p.id === cartItem.productId
        );

        if (!product) {
            missingProducts = true;

            checkoutItems.innerHTML += `
                <div class="checkout-item">
                    <div class="checkout-item-info">
                        <h3>Product unavailable</h3>
                        <p>Item could not be loaded from the catalog.</p>
                    </div>
                </div>
            `;

            return;
        }

        const productName = getProductField(product, [
            "name",
            "productName",
            "product_name",
            "productTitle",
            "product_title",
            "title",
            "itemName",
            "Name"
        ]) || `Product ${product.id}`;

        const price = Number(
            getProductField(product, [
                "price",
                "productPrice",
                "product_price",
                "sellingPrice",
                "selling_price"
            ])
        ) || 0;

        const quantity = Number(cartItem.quantity) || 1;
        const itemTotal = price * quantity;

        subtotal += itemTotal;

        checkoutItems.innerHTML += `
            <div class="checkout-item">
                <div class="checkout-item-info">
                    <h3>${escapeHTML(productName)}</h3>
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

    checkoutSubtotal.textContent =
        `₹${subtotal.toLocaleString("en-IN")}`;

    checkoutShipping.textContent =
        shipping === 0 ? "FREE" : `₹${shipping}`;

    checkoutTotal.textContent =
        `₹${total.toLocaleString("en-IN")}`;

    // Payment can continue only when address is saved and all products loaded
    const savedAddress = sessionStorage.getItem("veloraCheckoutAddress");

    placeOrderBtn.disabled = !savedAddress || missingProducts;
}

// Save delivery address to Firestore
addressForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!user) {
        alert("Please login to continue checkout.");
        window.location.href = "login.html";
        return;
    }

    const address = {
        fullName: document.getElementById("fullName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        addressLine: document.getElementById("addressLine").value.trim(),
        landmark: document.getElementById("landmark").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: document.getElementById("state").value.trim(),
        pincode: document.getElementById("pincode").value.trim(),
        addressType: document.getElementById("addressType").value,
        userId: user.userId || user.documentId,
        createdAt: new Date().toISOString()
    };

    const saveAddressBtn = document.getElementById("saveAddressBtn");
    saveAddressBtn.disabled = true;
    saveAddressBtn.textContent = "Saving address...";

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
            const errorData = await response.json();
            console.error("Firestore address error:", errorData);
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

        renderCheckout();

    } catch (error) {
        console.error("Address save error:", error);
        alert("Unable to save address. Please try again.");

    } finally {
        saveAddressBtn.disabled = false;
        saveAddressBtn.textContent = "Save Delivery Address";
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

// Require login
if (!user) {
    alert("Please login to continue checkout.");
    window.location.href = "login.html";
} else {
    fetchProducts();
}