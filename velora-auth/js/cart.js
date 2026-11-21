const FIRESTORE_PRODUCTS_URL =
    "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Products?pageSize=1000&key=AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const cartItemsContainer = document.getElementById("cartItems");
const emptyCart = document.getElementById("emptyCart");
const cartLayout = document.querySelector(".cart-layout");

function getCart() {
    return JSON.parse(localStorage.getItem("veloraCart")) || [];
}

function saveCart(cart) {
    localStorage.setItem("veloraCart", JSON.stringify(cart));
}

function formatPrice(price) {
    return "₹" + Number(price).toLocaleString("en-IN");
}

async function loadCartProducts() {
    try {
        const response = await fetch(FIRESTORE_PRODUCTS_URL);

        if (!response.ok) {
            throw new Error("Failed to fetch products from Firestore");
        }

        const data = await response.json();

        return (data.documents || []).map(document => {
            const fields = document.fields;

            return {
                productId: fields.productId?.stringValue || document.name.split("/").pop(),
                productName: fields.productName?.stringValue || "Unnamed Product",
                description: fields.description?.stringValue || "",
                price: Number(fields.price?.doubleValue || fields.price?.integerValue || 0),
                stock: Number(fields.stock?.integerValue || 0),
                status: fields.status?.stringValue || "active"
            };
        });
    } catch (error) {
        console.error("Product loading error:", error);
        cartItemsContainer.innerHTML =
            `<p class="cart-error">Unable to load products. Please refresh.</p>`;
        return [];
    }
}

function renderCart(cart, products) {
    const validCart = cart.filter(item => item.quantity > 0);
    const cartProducts = validCart.map(item => {
        const product = products.find(p => p.productId === item.productId);

        if (!product) return null;

        return {
            ...product,
            quantity: item.quantity,
            itemTotal: product.price * item.quantity
        };
    }).filter(Boolean);

    if (cartProducts.length === 0) {
        cartLayout.style.display = "none";
        emptyCart.style.display = "block";
        updateSummary(0);
        return;
    }

    cartLayout.style.display = "grid";
    emptyCart.style.display = "none";

    cartItemsContainer.innerHTML = cartProducts.map(product => `
        <div class="cart-product">
            <div class="cart-product-info">
                <div class="cart-product-image">
                    <span>${getProductEmoji(product.categoryId)}</span>
                </div>
                <div class="cart-product-details">
                    <h3>${escapeHTML(product.productName)}</h3>
                    <p>${formatPrice(product.price)}</p>
                    <button class="remove-button" data-id="${product.productId}">
                        Remove
                    </button>
                </div>
            </div>

            <div class="quantity-controls">
                <button class="quantity-button decrease" data-id="${product.productId}">−</button>
                <span>${product.quantity}</span>
                <button class="quantity-button increase" data-id="${product.productId}">+</button>
            </div>

            <div class="cart-product-total">
                ${formatPrice(product.itemTotal)}
            </div>
        </div>
    `).join("");

    const subtotal = cartProducts.reduce((sum, product) => sum + product.itemTotal, 0);

    updateSummary(subtotal);
    attachCartEvents();
}

function updateSummary(subtotal) {
    const shipping = subtotal === 0 || subtotal >= 999 ? 0 : 50;
    const total = subtotal + shipping;

    document.getElementById("cartSubtotal").textContent = formatPrice(subtotal);
    document.getElementById("cartShipping").textContent =
        shipping === 0 && subtotal > 0 ? "FREE" : formatPrice(shipping);
    document.getElementById("cartTotal").textContent = formatPrice(total);
}

function getProductEmoji(categoryId) {
    const emojis = {
        cat001: "👕",
        cat002: "🎧",
        cat003: "📚",
        cat004: "🏠",
        cat005: "🧴"
    };

    return emojis[categoryId] || "🛍️";
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function attachCartEvents() {
    document.querySelectorAll(".increase").forEach(button => {
        button.addEventListener("click", () => changeQuantity(button.dataset.id, 1));
    });

    document.querySelectorAll(".decrease").forEach(button => {
        button.addEventListener("click", () => changeQuantity(button.dataset.id, -1));
    });

    document.querySelectorAll(".remove-button").forEach(button => {
        button.addEventListener("click", () => removeProduct(button.dataset.id));
    });
}

async function changeQuantity(productId, change) {

    const cart = getCart();
    const item = cart.find(item => item.productId === productId);

    if (!item) return;

    item.quantity += change;

    const updatedCart = item.quantity <= 0
        ? cart.filter(item => item.productId !== productId)
        : cart;

    saveCart(updatedCart);

    const loggedInUser = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (loggedInUser && loggedInUser.role !== "admin") {
        await syncLoggedInCart(loggedInUser, updatedCart);
    }

    initializeCart();
}


async function removeProduct(productId) {

    const updatedCart = getCart().filter(
        item => item.productId !== productId
    );

    saveCart(updatedCart);

    const loggedInUser = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (loggedInUser && loggedInUser.role !== "admin") {
        await syncLoggedInCart(loggedInUser, updatedCart);
    }

    initializeCart();
}
async function syncLoggedInCart(user, cart) {

    if (!user || user.role === "admin") return;

    const cartURL =
        `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Carts/${encodeURIComponent(user.userId)}?key=AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M`;

    const fields = {
        userId: {
            stringValue: user.userId
        },
        documentId: {
            stringValue: user.documentId || user.userId
        },
        name: {
            stringValue: user.name || ""
        },
        email: {
            stringValue: user.email || ""
        },
        cartItems: {
            arrayValue: {
                values: cart.map(item => ({
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

    const response = await fetch(cartURL, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
    });

    if (!response.ok) {
        const error = await response.json();
        console.error("Cart sync error:", error);
        throw new Error("Failed to update cart in Firebase.");
    }
}


async function initializeCart() {

    const loggedInUser = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    let localCart = getCart();

    // Load saved cart from Firestore for logged-in customers
    if (loggedInUser && loggedInUser.role !== "admin") {

        const cartURL =
            `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Carts/${encodeURIComponent(loggedInUser.userId)}?key=AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M`;

        try {

            const response = await fetch(cartURL);

            if (response.ok) {

                const data = await response.json();

                const firestoreCart =
                    data.fields?.cartItems?.arrayValue?.values || [];

                const savedCart = firestoreCart.map(item => ({
                    productId: item.mapValue.fields.productId.stringValue,
                    quantity: Number(
                        item.mapValue.fields.quantity.integerValue || 0
                    )
                }));

                // Merge local and Firestore carts
                savedCart.forEach(savedItem => {

                    const localItem = localCart.find(
                        item => item.productId === savedItem.productId
                    );

                    if (localItem) {
                        localItem.quantity = Math.max(
                            localItem.quantity,
                            savedItem.quantity
                        );
                    } else {
                        localCart.push(savedItem);
                    }

                });

                await syncLoggedInCart(loggedInUser, localCart);

            }

        } catch (error) {
            console.error("Cart loading error:", error);
        }
    }

    const products = await loadCartProducts();

    renderCart(localCart, products);
}

document.getElementById("checkoutButton").addEventListener("click", () => {
    alert("Checkout will be connected in the next step!");
});

initializeCart();

// Proceed to Checkout
document.getElementById("checkoutButton").addEventListener("click", () => {
    const cart = JSON.parse(localStorage.getItem("veloraCart")) || [];

    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    const loggedInUser = sessionStorage.getItem("veloraUser");

    if (!loggedInUser) {
        alert("Please login to continue checkout.");
        window.location.href = "login.html";
        return;
    }

    window.location.href = "checkout.html";
});