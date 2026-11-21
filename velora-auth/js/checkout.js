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

const savedAddressesSection =
    document.getElementById("savedAddressesSection");

const savedAddressesContainer =
    document.getElementById("savedAddresses");

const addNewAddressBtn =
    document.getElementById("addNewAddressBtn");

const saveAddressBtn =
    document.getElementById("saveAddressBtn");

let subtotal = 0;
let shipping = 0;
let total = 0;
let products = [];
let savedAddresses = [];
let selectedAddress = null;
let editingAddressId = null;
let missingProducts = false;

// --------------------------------------------------
// FIRESTORE DECODING
// --------------------------------------------------

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

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

// --------------------------------------------------
// FETCH PRODUCTS
// --------------------------------------------------

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

// --------------------------------------------------
// RENDER CHECKOUT ITEMS
// --------------------------------------------------

function renderCheckout() {
    checkoutItems.innerHTML = "";
    subtotal = 0;
    missingProducts = false;

    if (cart.length === 0) {
        checkoutItems.innerHTML = "<p>Your cart is empty.</p>";
        placeOrderBtn.disabled = true;
        return;
    }

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
            "itemName"
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

    placeOrderBtn.disabled =
        !selectedAddress || missingProducts;
}

// --------------------------------------------------
// FETCH SAVED ADDRESSES
// --------------------------------------------------

async function fetchSavedAddresses() {
    try {
        const userId = user.userId || user.documentId;

        const response = await fetch(
            `${FIRESTORE_URL}:runQuery?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    structuredQuery: {
                        from: [
                            {
                                collectionId: "Addresses"
                            }
                        ],
                        where: {
                            fieldFilter: {
                                field: {
                                    fieldPath: "userId"
                                },
                                op: "EQUAL",
                                value: {
                                    stringValue: userId
                                }
                            }
                        }
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error("Unable to fetch saved addresses");
        }

        const data = await response.json();

        savedAddresses = data
            .filter(item => item.document)
            .map(item => ({
                documentId: item.document.name.split("/").pop(),
                ...decodeFirestoreFields(item.document.fields || {})
            }));

        console.log("Saved addresses:", savedAddresses);

        // Restore previous selection
        const previousAddress = JSON.parse(
            sessionStorage.getItem("veloraCheckoutAddress") || "null"
        );

        if (previousAddress) {
            selectedAddress = savedAddresses.find(
                address =>
                    address.documentId === previousAddress.documentId
            ) || null;
        }

        // Select first address if no previous selection
        if (!selectedAddress && savedAddresses.length > 0) {
            selectedAddress = savedAddresses[0];

            sessionStorage.setItem(
                "veloraCheckoutAddress",
                JSON.stringify(selectedAddress)
            );
        }

        renderSavedAddresses();
        renderCheckout();

    } catch (error) {
        console.error("Error fetching saved addresses:", error);

        savedAddresses = [];
        selectedAddress = null;

        savedAddressesSection.style.display = "none";
        addressForm.style.display = "block";

        renderCheckout();
    }
}

// --------------------------------------------------
// RENDER SAVED ADDRESS CARDS
// --------------------------------------------------

function renderSavedAddresses() {
    if (savedAddresses.length === 0) {
        savedAddressesSection.style.display = "none";
        addressForm.style.display = "block";
        return;
    }

    savedAddressesSection.style.display = "block";

    if (!editingAddressId) {
        addressForm.style.display = "none";
    }

    savedAddressesContainer.innerHTML = "";

    savedAddresses.forEach(address => {
        const isSelected =
            selectedAddress &&
            selectedAddress.documentId === address.documentId;

        const card = document.createElement("div");

        card.className =
            `saved-address-card ${isSelected ? "selected" : ""}`;

        card.innerHTML = `
            <label>
                <input
                    type="radio"
                    name="selectedAddress"
                    ${isSelected ? "checked" : ""}
                >

                <strong>${escapeHTML(address.fullName)}</strong>

                <span class="address-type-badge">
                    ${escapeHTML(address.addressType || "Address")}
                </span>
            </label>

            <p>
                ${escapeHTML(address.phone)}<br>
                ${escapeHTML(address.addressLine)}<br>
                ${address.landmark
                    ? escapeHTML(address.landmark) + "<br>"
                    : ""}
                ${escapeHTML(address.city)},
                ${escapeHTML(address.state)} -
                ${escapeHTML(address.pincode)}
            </p>

            <div class="saved-address-actions">
                <button
                    type="button"
                    class="edit-address-button"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="delete-address-button"
                >
                    Delete
                </button>
            </div>
        `;

        // Edit button
        card.querySelector(".edit-address-button")
            .addEventListener("click", function (e) {
                e.stopPropagation();
                editAddress(address);
            });

        // Delete button
        card.querySelector(".delete-address-button")
            .addEventListener("click", function (e) {
                e.stopPropagation();
                deleteAddress(address);
            });

        // Select address
        card.addEventListener("click", function () {
            if (editingAddressId) return;

            selectedAddress = address;

            sessionStorage.setItem(
                "veloraCheckoutAddress",
                JSON.stringify(address)
            );

            renderSavedAddresses();
            renderCheckout();
        });

        savedAddressesContainer.appendChild(card);
    });
}

// --------------------------------------------------
// ADD NEW ADDRESS
// --------------------------------------------------

addNewAddressBtn.addEventListener("click", function () {
    editingAddressId = null;

    addressForm.reset();
    addressForm.style.display = "block";

    saveAddressBtn.textContent = "Save Delivery Address";

    removeCancelEditButton();

    addressForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// --------------------------------------------------
// CANCEL EDIT BUTTON
// --------------------------------------------------

function removeCancelEditButton() {
    const existingButton = document.getElementById("cancelEditAddressBtn");

    if (existingButton) {
        existingButton.remove();
    }
}

function createCancelEditButton() {
    removeCancelEditButton();

    const cancelButton = document.createElement("button");

    cancelButton.type = "button";
    cancelButton.id = "cancelEditAddressBtn";
    cancelButton.textContent = "Cancel";
    cancelButton.className = "add-address-button";

    saveAddressBtn.insertAdjacentElement("afterend", cancelButton);

    cancelButton.addEventListener("click", function () {
        editingAddressId = null;

        addressForm.reset();
        addressForm.style.display = "none";

        saveAddressBtn.textContent = "Save Delivery Address";

        removeCancelEditButton();

        renderSavedAddresses();
    });
}

// --------------------------------------------------
// EDIT ADDRESS
// --------------------------------------------------

function editAddress(address) {
    editingAddressId = address.documentId;

    document.getElementById("fullName").value =
        address.fullName || "";

    document.getElementById("phone").value =
        address.phone || "";

    document.getElementById("addressLine").value =
        address.addressLine || "";

    document.getElementById("landmark").value =
        address.landmark || "";

    document.getElementById("city").value =
        address.city || "";

    document.getElementById("state").value =
        address.state || "";

    document.getElementById("pincode").value =
        address.pincode || "";

    document.getElementById("addressType").value =
        address.addressType || "Home";

    addressForm.style.display = "block";

    saveAddressBtn.textContent = "Update Address";

    createCancelEditButton();

    addressForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// --------------------------------------------------
// DELETE ADDRESS
// --------------------------------------------------

async function deleteAddress(address) {
    const confirmDelete = confirm(
        `Are you sure you want to delete this address?\n\n${address.addressLine}, ${address.city}`
    );

    if (!confirmDelete) return;

    try {
        const response = await fetch(
            `${FIRESTORE_URL}/Addresses/${address.documentId}?key=${API_KEY}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            throw new Error("Failed to delete address");
        }

        savedAddresses = savedAddresses.filter(
            item => item.documentId !== address.documentId
        );

        // If deleted address was selected, select another
        if (
            selectedAddress &&
            selectedAddress.documentId === address.documentId
        ) {
            selectedAddress = savedAddresses.length > 0
                ? savedAddresses[0]
                : null;

            if (selectedAddress) {
                sessionStorage.setItem(
                    "veloraCheckoutAddress",
                    JSON.stringify(selectedAddress)
                );
            } else {
                sessionStorage.removeItem("veloraCheckoutAddress");
            }
        }

        renderSavedAddresses();
        renderCheckout();

        alert("Address deleted successfully!");

    } catch (error) {
        console.error("Delete address error:", error);
        alert("Unable to delete address. Please try again.");
    }
}

// --------------------------------------------------
// SAVE / UPDATE ADDRESS
// --------------------------------------------------

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

    saveAddressBtn.disabled = true;
    saveAddressBtn.textContent =
        editingAddressId ? "Updating address..." : "Saving address...";

    try {
        const fields = {
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
        };

        let response;
        let documentId;

        // UPDATE EXISTING ADDRESS
        if (editingAddressId) {
            const oldAddress = savedAddresses.find(
                item => item.documentId === editingAddressId
            );

            address.createdAt = oldAddress?.createdAt || address.createdAt;

            fields.createdAt = {
                stringValue: address.createdAt
            };

            response = await fetch(
                `${FIRESTORE_URL}/Addresses/${editingAddressId}?key=${API_KEY}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ fields })
                }
            );

            documentId = editingAddressId;

        } else {
            // CREATE NEW ADDRESS
            response = await fetch(
                `${FIRESTORE_URL}/Addresses?key=${API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ fields })
                }
            );
        }

        if (!response.ok) {
            const errorData = await response.json();

            console.error("Firestore address error:", errorData);

            throw new Error("Failed to save address");
        }

        const savedDocument = await response.json();

        if (!editingAddressId) {
            documentId = savedDocument.name.split("/").pop();
        }

        address.documentId = documentId;

        // Update local address list
        if (editingAddressId) {
            savedAddresses = savedAddresses.map(item =>
                item.documentId === editingAddressId
                    ? address
                    : item
            );
        } else {
            savedAddresses.push(address);
        }

        selectedAddress = address;

        sessionStorage.setItem(
            "veloraCheckoutAddress",
            JSON.stringify(address)
        );

        editingAddressId = null;

        addressForm.reset();
        addressForm.style.display = "none";

        saveAddressBtn.textContent = "Save Delivery Address";

        removeCancelEditButton();

        renderSavedAddresses();
        renderCheckout();

        alert("Address saved successfully!");

    } catch (error) {
        console.error("Address save/update error:", error);

        alert("Unable to save address. Please try again.");

    } finally {
        saveAddressBtn.disabled = false;

        if (!editingAddressId) {
            saveAddressBtn.textContent = "Save Delivery Address";
        }
    }
});

// --------------------------------------------------
// CONTINUE TO PAYMENT
// --------------------------------------------------

placeOrderBtn.addEventListener("click", function () {
    if (!selectedAddress) {
        alert("Please select or save a delivery address first.");
        return;
    }

    sessionStorage.setItem(
        "veloraCheckoutAddress",
        JSON.stringify(selectedAddress)
    );

    alert("Delivery address confirmed! Payment step will be added next.");
});

// --------------------------------------------------
// LOGIN CHECK & INITIALIZATION
// --------------------------------------------------

if (!user) {
    alert("Please login to continue checkout.");
    window.location.href = "login.html";
} else {
    fetchProducts();
    fetchSavedAddresses();
}