/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Products?pageSize=1000&key=${API_KEY}`;

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;


/* =========================
   STATE
========================= */

let allProducts = [];
let currentFilter = "all";
let wishlistIds = new Set();


/* =========================
   DOM ELEMENTS
========================= */

const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const cartButton = document.getElementById("cartButton");


/* =========================
   CATEGORY DATA
========================= */

const categoryNames = {
    cat001: "Clothing",
    cat002: "Electronics",
    cat003: "Books",
    cat004: "Home Essentials",
    cat005: "Beauty & Personal Care",

    clothing: "Clothing",
    electronics: "Electronics",
    books: "Books",
    "home-essentials": "Home Essentials",
    "beauty-personal-care": "Beauty & Personal Care"
};

const categoryEmojis = {
    cat001: "👕",
    cat002: "🎧",
    cat003: "📚",
    cat004: "🏡",
    cat005: "🧴",

    clothing: "👕",
    electronics: "🎧",
    books: "📚",
    "home-essentials": "🏡",
    "beauty-personal-care": "🧴"
};


/* =========================
   FIRESTORE HELPERS
========================= */

function getFieldValue(field) {
    if (!field) return "";

    return field.stringValue ??
        field.integerValue ??
        field.doubleValue ??
        field.booleanValue ??
        "";
}

function decode(value) {
    if (!value) return "";

    if (value.stringValue !== undefined) {
        return value.stringValue;
    }

    if (value.integerValue !== undefined) {
        return Number(value.integerValue);
    }

    if (value.doubleValue !== undefined) {
        return Number(value.doubleValue);
    }

    if (value.booleanValue !== undefined) {
        return value.booleanValue;
    }

    if (value.arrayValue) {
        return (value.arrayValue.values || []).map(decode);
    }

    if (value.mapValue) {
        return decodeFields(value.mapValue.fields);
    }

    return "";
}

function decodeFields(fields) {
    const result = {};

    Object.entries(fields || {}).forEach(([key, value]) => {
        result[key] = decode(value);
    });

    return result;
}


/* =========================
   HTML ESCAPE
========================= */

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[character]));
}


/* =========================
   CATEGORY NORMALIZATION
========================= */

function normalizeCategory(category) {
    const value = String(category || "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\s+/g, "-");

    const categoryMap = {
        "clothing": "cat001",
        "cat001": "cat001",

        "electronics": "cat002",
        "cat002": "cat002",

        "books": "cat003",
        "cat003": "cat003",

        "home": "cat004",
        "home-essentials": "cat004",
        "cat004": "cat004",

        "beauty": "cat005",
        "beauty-and-personal-care": "cat005",
        "beauty-personal-care": "cat005",
        "cat005": "cat005"
    };

    return categoryMap[value] || value;
}


/* =========================
   IMAGE URL NORMALIZATION
========================= */

fetch(FIRESTORE_URL)
    .then(response => response.json())
    .then(data => {
        console.table(
            (data.documents || []).map(doc => {
                const f = doc.fields || {};

                return {
                    product: f.productName?.stringValue || f.name?.stringValue,
                    imageUrl: f.imageUrl?.stringValue,
                    image: f.image?.stringValue,
                    productImage: f.productImage?.stringValue,
                    imagePath: f.imagePath?.stringValue
                };
            })
        );
    });

/* =========================
   LOAD WISHLIST
========================= */

async function loadWishlist() {
    const user = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (!user) return;

    try {
        const userId = user.userId || user.documentId;

        const response = await fetch(
            `${FIRESTORE}/Wishlists/${userId}?key=${API_KEY}`
        );

        if (!response.ok) return;

        const data = await response.json();

        wishlistIds = new Set(
            (decode(data.fields?.items) || [])
                .map(item => item.productId)
        );

    } catch (error) {
        console.warn("Wishlist loading error:", error);
    }
}


/* =========================
   SAVE WISHLIST
========================= */

async function saveWishlist() {
    const user = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (!user) {
        localStorage.setItem(
            "veloraWishlist",
            JSON.stringify([...wishlistIds])
        );

        return;
    }

    const userId = user.userId || user.documentId;

    const fields = {
        userId: {
            stringValue: userId
        },

        items: {
            arrayValue: {
                values: [...wishlistIds].map(id => ({
                    mapValue: {
                        fields: {
                            productId: {
                                stringValue: id
                            },

                            savedAt: {
                                stringValue: new Date().toISOString()
                            }
                        }
                    }
                }))
            }
        },

        updatedAt: {
            stringValue: new Date().toISOString()
        }
    };

    await fetch(
        `${FIRESTORE}/Wishlists/${userId}?key=${API_KEY}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ fields })
        }
    );
}


/* =========================
   TOGGLE WISHLIST
========================= */

async function toggleWishlist(id) {
    if (!sessionStorage.getItem("veloraUser")) {
        alert("Login to save your wishlist.");
        location.href = "login.html";
        return;
    }

    if (wishlistIds.has(id)) {
        wishlistIds.delete(id);
    } else {
        wishlistIds.add(id);
    }

    try {
        await saveWishlist();
        renderProducts();
    } catch (error) {
        alert("Wishlist update failed. Please retry.");
    }
}


/* =========================
   FETCH PRODUCTS FROM FIRESTORE
========================= */

async function fetchProducts() {
    try {
        const response = await fetch(FIRESTORE_URL);

        if (!response.ok) {
            throw new Error(`Products fetch failed: ${response.status}`);
        }

        const data = await response.json();

        allProducts = (data.documents || [])
            .map(document => {
                const fields = document.fields || {};

                const documentId = document.name.split("/").pop();

                const rawCategory = getFieldValue(fields.categoryId);

                return {
                    id: documentId,

                    productId:
                        getFieldValue(fields.productId) ||
                        documentId,

                    productName:
                        getFieldValue(fields.productName) ||
                        getFieldValue(fields.name),

                    categoryId: normalizeCategory(rawCategory),

                    description:
                        getFieldValue(fields.description),

                    price:
                        Number(getFieldValue(fields.price) || 0),

                    stock:
                        Number(getFieldValue(fields.stock) || 0),

                    status:
                        getFieldValue(fields.status) || "active",

                    imageUrl:
                        normalizeImageUrl(
                            getFieldValue(fields.imageUrl) ||
                            getFieldValue(fields.image) ||
                            getFieldValue(fields.productImage)
                        )
                };
            })
            .filter(product => product.status === "active");

        renderProducts();

    } catch (error) {
        console.error("Product loading error:", error);

        productsGrid.innerHTML = `
            <div class="loading-message">
                Unable to load products. Please check your connection.
            </div>
        `;
    }
}


/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts() {
    let list = [...allProducts];

    /* CATEGORY FILTER */

    if (currentFilter !== "all") {
        list = list.filter(
            product => product.categoryId === currentFilter
        );
    }

    /* SEARCH */

    const term = searchInput.value.trim().toLowerCase();

    if (term) {
        list = list.filter(product =>
            String(product.productName).toLowerCase().includes(term) ||
            String(product.description).toLowerCase().includes(term) ||
            String(categoryNames[product.categoryId] || "")
                .toLowerCase().includes(term)
        );
    }

    /* SORT */

    switch (sortSelect.value) {
        case "low-high":
            list.sort((a, b) => a.price - b.price);
            break;

        case "high-low":
            list.sort((a, b) => b.price - a.price);
            break;

        case "name":
            list.sort((a, b) =>
                String(a.productName).localeCompare(String(b.productName))
            );
            break;
    }

    /* EMPTY RESULT */

    if (!list.length) {
        productsGrid.innerHTML = `
            <div class="loading-message">
                No products found.
            </div>
        `;
        return;
    }

    /* PRODUCT CARDS */

    productsGrid.innerHTML = list.map(product => {
        const category = product.categoryId;

        const emoji = categoryEmojis[category] || "🛍️";

        const categoryName = categoryNames[category] || "Collection";

        const isSaved = wishlistIds.has(product.productId);

        return `
            <article class="product-card">

                <div class="product-visual ${esc(category)}">

                    <span class="product-emoji">
                        ${emoji}
                    </span>

                    ${
                        product.imageUrl
                            ? `
                                <img
                                    class="product-image"
                                    src="${esc(product.imageUrl)}"
                                    alt="${esc(product.productName)}"
                                >
                              `
                            : ""
                    }

                    <span class="product-category">
                        ${esc(categoryName)}
                    </span>

                    <button
                        type="button"
                        class="wishlist-toggle ${isSaved ? "saved" : ""}"
                        data-wish="${esc(product.productId)}"
                        aria-label="Wishlist"
                        title="${isSaved ? "Remove from wishlist" : "Add to wishlist"}"
                    >
                        ${isSaved ? "♥" : "♡"}
                    </button>

                </div>

                <div class="product-info">

                    <p class="product-category-label">
                        ${esc(categoryName)}
                    </p>

                    <h3>
                        ${esc(product.productName)}
                    </h3>

                    <p class="product-description">
                        ${esc(product.description)}
                    </p>

                    <div class="product-bottom">

                        <span class="product-price">
                            ₹${product.price.toLocaleString("en-IN")}
                        </span>

                        <button
                            class="add-cart-btn"
                            data-product-id="${esc(product.productId)}"
                        >
                            Add to cart +
                        </button>

                    </div>

                </div>

            </article>
        `;
    }).join("");

    /* IMAGE ERROR FALLBACK */

    productsGrid.querySelectorAll(".product-image").forEach(image => {
        image.onerror = function () {
            this.style.display = "none";

            const emoji = this.parentElement.querySelector(".product-emoji");

            if (emoji) {
                emoji.style.display = "flex";
            }
        };

        image.onload = function () {
            const emoji = this.parentElement.querySelector(".product-emoji");

            if (emoji) {
                emoji.style.display = "none";
            }
        };
    });

    /* CART EVENTS */

    productsGrid.querySelectorAll(".add-cart-btn").forEach(button => {
        button.onclick = () => {
            addToCart(button.dataset.productId);
        };
    });

    /* WISHLIST EVENTS */

    productsGrid.querySelectorAll(".wishlist-toggle").forEach(button => {
        button.onclick = () => {
            toggleWishlist(button.dataset.wish);
        };
    });
}


/* =========================
   CART
========================= */

function getCart() {
    return JSON.parse(
        localStorage.getItem("veloraCart") || "[]"
    );
}

function saveCart(cart) {
    localStorage.setItem(
        "veloraCart",
        JSON.stringify(cart)
    );

    updateCartCount();
}

function addToCart(id) {
    const cart = getCart();

    const item = cart.find(
        product => product.productId === id
    );

    if (item) {
        item.quantity++;
    } else {
        cart.push({
            productId: id,
            quantity: 1
        });
    }

    saveCart(cart);

    alert("Product added to your cart!");
}

function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const element = document.getElementById("cartCount");

    if (element) {
        element.textContent = count;
    }
}


/* =========================
   CATEGORY FILTER BUTTONS
========================= */

document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        currentFilter = button.dataset.filter;

        renderProducts();
    });
});


/* =========================
   CATEGORY CARDS
========================= */

document.querySelectorAll(".category-card").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.category;

        document.querySelectorAll(".filter-btn").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.filter === currentFilter
            );
        });

        renderProducts();

        document.getElementById("products").scrollIntoView({
            behavior: "smooth"
        });
    });
});


/* =========================
   SEARCH & SORT
========================= */

searchInput.addEventListener("input", renderProducts);

sortSelect.addEventListener("change", renderProducts);


/* =========================
   CART NAVIGATION
========================= */

if (cartButton) {
    cartButton.onclick = () => {
        location.href = "cart.html";
    };
}


/* =========================
   LOGIN & PROFILE
========================= */

const loginLink = document.getElementById("loginLink");

const profileLink = document.getElementById("profileLink");

const user = JSON.parse(
    sessionStorage.getItem("veloraUser") || "null"
);

if (user) {
    if (loginLink) {
        loginLink.style.display = "none";
    }

    if (profileLink) {
        profileLink.style.display = "inline-block";
    }
} else {
    if (loginLink) {
        loginLink.style.display = "inline-block";
    }

    if (profileLink) {
        profileLink.style.display = "none";
    }

    wishlistIds = new Set(
        JSON.parse(localStorage.getItem("veloraWishlist") || "[]")
    );
}


/* =========================
   INITIALIZATION
========================= */

updateCartCount();

loadWishlist().then(fetchProducts);