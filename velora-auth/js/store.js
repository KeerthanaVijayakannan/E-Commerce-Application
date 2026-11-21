/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Products?pageSize=1000&key=${API_KEY}`;

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;


/* =========================
   STATE VARIABLES
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
const loadingMessage = document.getElementById("loadingMessage");
const cartButton = document.getElementById("cartButton");


/* =========================
   CATEGORY DATA
========================= */

const categoryNames = {
    cat001: "Clothing",
    cat002: "Electronics",
    cat003: "Books",
    cat004: "Home Essentials",
    cat005: "Beauty & Personal Care"
};

const categoryEmojis = {
    cat001: "👕",
    cat002: "🎧",
    cat003: "📚",
    cat004: "🏡",
    cat005: "🧴"
};


/* =========================
   FIRESTORE DATA HELPERS
========================= */

function getFieldValue(f) {
    if (!f) return "";

    return f.stringValue ??
        f.integerValue ??
        f.doubleValue ??
        f.booleanValue ??
        "";
}

function decode(v) {
    if (!v) return "";

    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.booleanValue !== undefined) return v.booleanValue;

    if (v.arrayValue) {
        return (v.arrayValue.values || []).map(decode);
    }

    if (v.mapValue) {
        return decodeFields(v.mapValue.fields);
    }

    return "";
}

function decodeFields(f) {
    const o = {};

    Object.entries(f || {}).forEach(([k, v]) => {
        o[k] = decode(v);
    });

    return o;
}


/* =========================
   HTML ESCAPE HELPER
========================= */

function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[c]));
}


/* =========================
   LOAD WISHLIST
========================= */

async function loadWishlist() {
    const u = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (!u) return;

    try {
        const r = await fetch(
            `${FIRESTORE}/Wishlists/${u.userId || u.documentId}?key=${API_KEY}`
        );

        if (!r.ok) return;

        const d = await r.json();

        wishlistIds = new Set(
            (decode(d.fields?.items) || [])
                .map(x => x.productId)
        );

    } catch (e) {
        console.warn("Wishlist load", e);
    }
}


/* =========================
   SAVE WISHLIST
========================= */

async function saveWishlist() {
    const u = JSON.parse(
        sessionStorage.getItem("veloraUser") || "null"
    );

    if (!u) {
        localStorage.setItem(
            "veloraWishlist",
            JSON.stringify([...wishlistIds])
        );

        return;
    }

    const fields = {
        userId: {
            stringValue: u.userId || u.documentId
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
        `${FIRESTORE}/Wishlists/${u.userId || u.documentId}?key=${API_KEY}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fields
            })
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

    } catch (e) {
        alert("Wishlist update failed. Please retry.");
    }
}


/* =========================
   FETCH PRODUCTS
========================= */

async function fetchProducts() {
    try {
        const r = await fetch(FIRESTORE_URL);

        if (!r.ok) {
            throw Error(`Products fetch failed ${r.status}`);
        }

        const d = await r.json();

        allProducts = (d.documents || [])
            .map(doc => {
                const f = doc.fields || {};

                return {
                    id: doc.name.split("/").pop(),

                    productId:
                        getFieldValue(f.productId) ||
                        doc.name.split("/").pop(),

                    productName: getFieldValue(f.productName),
                    categoryId: getFieldValue(f.categoryId),
                    description: getFieldValue(f.description),
                    price: Number(getFieldValue(f.price)),
                    stock: Number(getFieldValue(f.stock)),
                    status: getFieldValue(f.status)
                };
            })
            .filter(p => p.status === "active");

        renderProducts();

    } catch (e) {
        console.error(e);

        productsGrid.innerHTML = `
            <div class="loading-message">
                Unable to load products. Check connection and Firestore settings.
            </div>
        `;
    }
}


/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts() {
    let list = [...allProducts];

    /* Category Filter */
    if (currentFilter !== "all") {
        list = list.filter(
            p => p.categoryId === currentFilter
        );
    }

    /* Search */
    const term = searchInput.value.trim().toLowerCase();

    if (term) {
        list = list.filter(
            p =>
                p.productName.toLowerCase().includes(term) ||
                p.description.toLowerCase().includes(term)
        );
    }

    /* Sorting */
    switch (sortSelect.value) {
        case "low-high":
            list.sort((a, b) => a.price - b.price);
            break;

        case "high-low":
            list.sort((a, b) => b.price - a.price);
            break;

        case "name":
            list.sort(
                (a, b) => a.productName.localeCompare(b.productName)
            );
            break;
    }

    /* Empty Results */
    if (!list.length) {
        productsGrid.innerHTML = `
            <div class="loading-message">
                No products found.
            </div>
        `;

        return;
    }

    /* Product Cards */
    productsGrid.innerHTML = list.map(p => `
        <article class="product-card">

            <div class="product-visual ${esc(p.categoryId)}">

                <span class="product-emoji">
                    ${categoryEmojis[p.categoryId] || "🛍️"}
                </span>

                <span class="product-category">
                    ${categoryNames[p.categoryId] || "Collection"}
                </span>

                <button
                    type="button"
                    class="wishlist-toggle ${wishlistIds.has(p.productId) ? "saved" : ""}"
                    data-wish="${esc(p.productId)}"
                    aria-label="Wishlist"
                    title="${wishlistIds.has(p.productId) ? "Remove from wishlist" : "Add to wishlist"}"
                >
                    ${wishlistIds.has(p.productId) ? "♥" : "♡"}
                </button>

            </div>

            <div class="product-info">

                <p class="product-category-label">
                    ${categoryNames[p.categoryId] || ""}
                </p>

                <h3>
                    ${esc(p.productName)}
                </h3>

                <p class="product-description">
                    ${esc(p.description)}
                </p>

                <div class="product-bottom">

                    <span class="product-price">
                        ₹${p.price.toLocaleString("en-IN")}
                    </span>

                    <button
                        class="add-cart-btn"
                        data-product-id="${esc(p.productId)}"
                    >
                        Add to cart +
                    </button>

                </div>

            </div>

        </article>
    `).join("");

    /* Add to Cart Button Events */
    productsGrid.querySelectorAll(".add-cart-btn").forEach(b => {
        b.onclick = () => addToCart(b.dataset.productId);
    });

    /* Wishlist Button Events */
    productsGrid.querySelectorAll(".wishlist-toggle").forEach(b => {
        b.onclick = () => toggleWishlist(b.dataset.wish);
    });
}


/* =========================
   CART FUNCTIONS
========================= */

function getCart() {
    return JSON.parse(
        localStorage.getItem("veloraCart") || "[]"
    );
}

function saveCart(c) {
    localStorage.setItem(
        "veloraCart",
        JSON.stringify(c)
    );

    updateCartCount();
}

function addToCart(id) {
    const c = getCart();

    const item = c.find(
        x => x.productId === id
    );

    if (item) {
        item.quantity++;
    } else {
        c.push({
            productId: id,
            quantity: 1
        });
    }

    saveCart(c);

    alert("Product added to your cart!");
}

function updateCartCount() {
    const c = getCart();

    const n = c.reduce(
        (s, x) => s + x.quantity,
        0
    );

    const el = document.getElementById("cartCount");

    if (el) {
        el.textContent = n;
    }
}


/* =========================
   CATEGORY FILTER BUTTONS
========================= */

document.querySelectorAll(".filter-btn").forEach(b => {
    b.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(x => {
            x.classList.remove("active");
        });

        b.classList.add("active");

        currentFilter = b.dataset.filter;

        renderProducts();
    });
});


/* =========================
   CATEGORY CARDS
========================= */

document.querySelectorAll(".category-card").forEach(b => {
    b.addEventListener("click", () => {
        currentFilter = b.dataset.category;

        document.querySelectorAll(".filter-btn").forEach(x => {
            x.classList.toggle(
                "active",
                x.dataset.filter === currentFilter
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
   LOGIN & PROFILE LINKS
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