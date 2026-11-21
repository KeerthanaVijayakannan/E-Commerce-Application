

const FIRESTORE_URL =
    "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents/Products?pageSize=1000&key=AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

let allProducts = [];
let currentFilter = "all";

const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const loadingMessage = document.getElementById("loadingMessage");

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

// Extract Firestore typed values
function getFieldValue(field) {
    if (!field) return "";

    return field.stringValue ??
        field.integerValue ??
        field.doubleValue ??
        field.booleanValue ??
        "";
}

// Fetch products from Firestore REST API
async function fetchProducts() {
    try {
        const response = await fetch(FIRESTORE_URL);

        if (!response.ok) {
            throw new Error("Firestore request failed: " + response.status);
        }

        const data = await response.json();

        allProducts = (data.documents || []).map(document => {
            const fields = document.fields || {};

            return {
                id: document.name.split("/").pop(),
                productId: getFieldValue(fields.productId),
                productName: getFieldValue(fields.productName),
                categoryId: getFieldValue(fields.categoryId),
                description: getFieldValue(fields.description),
                price: Number(getFieldValue(fields.price)),
                stock: Number(getFieldValue(fields.stock)),
                status: getFieldValue(fields.status)
            };
        }).filter(product => product.status === "active");

        renderProducts();
    } catch (error) {
        console.error("Product loading error:", error);

        productsGrid.innerHTML = `
            <div class="loading-message">
                Unable to load products.<br>
                Please check your connection and Firestore settings.
            </div>
        `;
    }
}

// Display products
function renderProducts() {
    let filteredProducts = [...allProducts];

    // Category filter
    if (currentFilter !== "all") {
        filteredProducts = filteredProducts.filter(
            product => product.categoryId === currentFilter
        );
    }

    // Search filter
    const searchTerm = searchInput.value.trim().toLowerCase();

    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product =>
            product.productName.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm)
        );
    }

    // Sorting
    switch (sortSelect.value) {
        case "low-high":
            filteredProducts.sort((a, b) => a.price - b.price);
            break;

        case "high-low":
            filteredProducts.sort((a, b) => b.price - a.price);
            break;

        case "name":
            filteredProducts.sort((a, b) =>
                a.productName.localeCompare(b.productName)
            );
            break;
    }

    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="loading-message">
                No products found.
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = filteredProducts.map(product => `
        <article class="product-card">
            <div class="product-visual ${product.categoryId}">
                <span class="product-emoji">
                    ${categoryEmojis[product.categoryId] || "🛍️"}
                </span>
                <span class="product-category">
                    ${categoryNames[product.categoryId] || "Collection"}
                </span>
            </div>

            <div class="product-info">
                <p class="product-category-label">
                    ${categoryNames[product.categoryId] || ""}
                </p>

                <h3>${escapeHTML(product.productName)}</h3>

                <p class="product-description">
                    ${escapeHTML(product.description)}
                </p>

                <div class="product-bottom">
                    <span class="product-price">
                        ₹${product.price.toLocaleString("en-IN")}
                    </span>

                    <button class="add-cart-btn"
                        data-product-id="${escapeHTML(product.productId)}">
                        Add to cart +
                    </button>
                </div>
            </div>
        </article>
    `).join("");

    // Add-to-cart buttons
    document.querySelectorAll(".add-cart-btn").forEach(button => {
        button.addEventListener("click", () => {
            addToCart(button.dataset.productId);
        });
    });
}

// Escape product text before inserting HTML
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Category filter buttons
document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");
        currentFilter = button.dataset.filter;
        renderProducts();
    });
});

// Category cards
document.querySelectorAll(".category-card").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.category;

        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.dataset.filter === currentFilter
            );
        });

        renderProducts();

        document.getElementById("products").scrollIntoView({
            behavior: "smooth"
        });
    });
});

// Search
searchInput.addEventListener("input", renderProducts);

// Sort
sortSelect.addEventListener("change", renderProducts);

// Cart using localStorage
function getCart() {
    return JSON.parse(localStorage.getItem("veloraCart") || "[]");
}

function saveCart(cart) {
    localStorage.setItem("veloraCart", JSON.stringify(cart));
    updateCartCount();
}

function addToCart(productId) {
    const cart = getCart();
    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            productId: productId,
            quantity: 1
        });
    }

    saveCart(cart);
    alert("Product added to your cart!");
}

function updateCartCount() {
    const cart = getCart();

    const totalItems = cart.reduce(
        (total, item) => total + item.quantity,
        0
    );

    document.getElementById("cartCount").textContent = totalItems;
}

// Cart button (temporary summary)
cartButton.addEventListener("click", () => {
    window.location.href = "cart.html";
});
// Initial load
updateCartCount();
fetchProducts();
// Update navbar based on login status
const loginLink = document.getElementById("loginLink");
const profileLink = document.getElementById("profileLink");

const loggedInUser = sessionStorage.getItem("veloraUser");

if (loggedInUser) {
    if (loginLink) loginLink.style.display = "none";
    if (profileLink) profileLink.style.display = "inline-block";
} else {
    if (loginLink) loginLink.style.display = "inline-block";
    if (profileLink) profileLink.style.display = "none";
}