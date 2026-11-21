// ======================================================
// VELORA ADMIN - PRODUCT MANAGEMENT
// FIRESTORE REST API
// ======================================================

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const BASE =
    "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents";

// HTML ELEMENTS
const productForm = document.getElementById("productForm");
const productNameInput = document.getElementById("productName");
const productCategoryInput = document.getElementById("productCategory");
const productPriceInput = document.getElementById("productPrice");
const productStockInput = document.getElementById("productStock");
const productDescriptionInput = document.getElementById("productDescription");
const productImageInput = document.getElementById("productImage");

const imagePreview = document.getElementById("imagePreview");
const productFormMessage = document.getElementById("productFormMessage");
const saveProductButton = document.getElementById("saveProductButton");

const productsGrid = document.getElementById("adminProductsGrid");
const productSearch = document.getElementById("productSearch");

const totalProductsElement = document.getElementById("totalProducts");
const totalStockElement = document.getElementById("totalStock");
const totalCategoriesElement = document.getElementById("totalCategories");
const lowStockElement = document.getElementById("lowStockProducts");

const productFormTitle = document.getElementById("productFormTitle");
const cancelEditButton = document.getElementById("cancelEditButton");
const clearProductForm = document.getElementById("clearProductForm");

let editingProductId = null;
let existingProducts = [];

// ======================================================
// ADMIN SESSION
// ======================================================

if (sessionStorage.getItem("veloraAdmin") !== "true") {
    // If your admin login uses a different session key,
    // update this check to match admin-login.js.
    // Do not redirect if the session key is not being used.
}

// ======================================================
// FIRESTORE DECODER
// ======================================================

function decodeFirestoreValue(value) {
    if (!value) return null;

    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.nullValue !== undefined) return null;

    if (value.arrayValue) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }

    if (value.mapValue) {
        return decodeFirestoreFields(value.mapValue.fields || {});
    }

    return null;
}

function decodeFirestoreFields(fields) {
    const result = {};

    Object.keys(fields).forEach(key => {
        result[key] = decodeFirestoreValue(fields[key]);
    });

    return result;
}

function decodeDocument(document) {
    return {
        id: document.name.split("/").pop(),
        ...decodeFirestoreFields(document.fields || {})
    };
}

// ======================================================
// FIRESTORE ENCODER
// ======================================================

function encodeFirestoreValue(value) {
    if (value === null) {
        return { nullValue: null };
    }

    if (typeof value === "string") {
        return { stringValue: value };
    }

    if (typeof value === "boolean") {
        return { booleanValue: value };
    }

    if (Number.isInteger(value)) {
        return { integerValue: String(value) };
    }

    if (typeof value === "number") {
        return { doubleValue: value };
    }

    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map(encodeFirestoreValue)
            }
        };
    }

    if (typeof value === "object") {
        return {
            mapValue: {
                fields: encodeFirestoreFields(value)
            }
        };
    }

    return { nullValue: null };
}

function encodeFirestoreFields(data) {
    const fields = {};

    Object.keys(data).forEach(key => {
        fields[key] = encodeFirestoreValue(data[key]);
    });

    return fields;
}

// ======================================================
// HELPERS
// ======================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });
}

function categoryToId(category) {
    return category.trim().toLowerCase().replace(/\s+/g, "-");
}

function getCategoryName(product) {
    return product.category || product.categoryName || product.categoryId || "Uncategorized";
}

function getProductName(product) {
    return product.productName || product.name || product.title || "Unnamed Product";
}

function getProductImage(product) {
    return product.imageUrl || product.image || product.imageURL || product.img || "";
}

function getProductStock(product) {
    return Number(product.stock ?? product.quantity ?? 0);
}

// ======================================================
// IMAGE PATHS
// Images are stored relative to customer store pages.
// ======================================================

function normalizeImagePath(path) {
    path = String(path || "").trim();

    if (!path) return "";

    if (path.startsWith("../img/")) {
        return path.substring(3);
    }

    if (path.startsWith("./img/")) {
        return path.substring(2);
    }

    return path;
}

function getAdminImagePath(path) {
    path = normalizeImagePath(path);

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:")
    ) {
        return path;
    }

    if (path.startsWith("img/")) {
        return "../" + path;
    }

    return path;
}

// ======================================================
// FETCH PRODUCTS
// ======================================================

async function fetchProducts() {
    const url = `${BASE}/Products?pageSize=1000&key=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();

        throw new Error(
            error.error?.message || "Failed to load products from Firestore."
        );
    }

    const data = await response.json();

    return (data.documents || []).map(decodeDocument);
}

// ======================================================
// PRODUCT STATISTICS
// ======================================================

function updateStatistics(products) {
    const totalStock = products.reduce((total, product) => {
        return total + getProductStock(product);
    }, 0);

    const categories = new Set(
        products.map(product => getCategoryName(product).trim().toLowerCase())
    );

    const lowStockProducts = products.filter(product => {
        const stock = getProductStock(product);
        return stock <= 5;
    });

    totalProductsElement.textContent = products.length.toLocaleString("en-IN");
    totalStockElement.textContent = totalStock.toLocaleString("en-IN");
    totalCategoriesElement.textContent = categories.size.toLocaleString("en-IN");
    lowStockElement.textContent = lowStockProducts.length.toLocaleString("en-IN");
}

// ======================================================
// IMAGE PREVIEW
// ======================================================

function updateImagePreview(path) {
    const imageURL = getAdminImagePath(path);

    imagePreview.innerHTML = "";
    imagePreview.classList.remove("image-failed");

    if (!imageURL) {
        imagePreview.innerHTML = `
            <span>Product image preview will appear here</span>
        `;
        return;
    }

    const img = document.createElement("img");

    img.src = imageURL;
    img.alt = "Product image preview";

    img.onerror = function () {
        imagePreview.innerHTML = `
            <span>Image not found. Please check the image path.</span>
        `;
        imagePreview.classList.add("image-failed");
    };

    imagePreview.appendChild(img);
}

productImageInput.addEventListener("input", () => {
    updateImagePreview(productImageInput.value);
});

// ======================================================
// FORM MESSAGE
// ======================================================

function showFormMessage(message, type = "") {
    productFormMessage.textContent = message;
    productFormMessage.className = "product-form-message";

    if (type) {
        productFormMessage.classList.add(type);
    }
}

// ======================================================
// RESET FORM
// ======================================================

function resetProductForm() {
    editingProductId = null;

    productForm.reset();

    productFormTitle.textContent = "Add New Product";
    saveProductButton.textContent = "Add Product to Store";

    cancelEditButton.style.display = "none";

    productFormMessage.textContent = "";
    productFormMessage.className = "product-form-message";

    updateImagePreview("");
}

productForm.addEventListener("reset", () => {
    setTimeout(() => {
        if (!editingProductId) {
            updateImagePreview("");
            productFormMessage.textContent = "";
        }
    }, 0);
});

cancelEditButton.addEventListener("click", resetProductForm);

// ======================================================
// EDIT PRODUCT
// ======================================================

function editProduct(product) {
    editingProductId = product.id;

    productNameInput.value = getProductName(product);
    productCategoryInput.value = getCategoryName(product);
    productPriceInput.value = product.price ?? "";
    productStockInput.value = getProductStock(product);
    productDescriptionInput.value = product.description || "";
    productImageInput.value = normalizeImagePath(getProductImage(product));

    productFormTitle.textContent = "Edit Existing Product";
    saveProductButton.textContent = "Update Product";
    cancelEditButton.style.display = "inline-block";

    showFormMessage("Editing " + getProductName(product));

    updateImagePreview(productImageInput.value);

    productForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ======================================================
// ADD / UPDATE PRODUCT
// ======================================================

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = productNameInput.value.trim();
    const category = productCategoryInput.value.trim();
    const price = Number(productPriceInput.value);
    const stock = Number(productStockInput.value);
    const description = productDescriptionInput.value.trim();
    const imageURL = normalizeImagePath(productImageInput.value);

    if (!name || !category || !description || !imageURL) {
        showFormMessage("Please complete all required fields.", "error");
        return;
    }

    if (!Number.isFinite(price) || price <= 0) {
        showFormMessage("Please enter a valid price.", "error");
        return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
        showFormMessage("Stock must be a non-negative whole number.", "error");
        return;
    }

    saveProductButton.disabled = true;

    try {
        const isEditing = Boolean(editingProductId);

        const productId = isEditing
            ? editingProductId
            : "VEL-" + Date.now();

        const oldProduct = existingProducts.find(p => p.id === productId);

        const productData = {
            productId: oldProduct?.productId || productId,
            productName: name,
            name: name,
            category: category,
            categoryId: categoryToId(category),
            description: description,
            price: price,
            stock: stock,
            quantity: stock,
            status: stock > 0 ? "active" : "inactive",
            imageUrl: imageURL,
            image: imageURL
        };

        saveProductButton.textContent = isEditing
            ? "Updating..."
            : "Adding...";

        const encodedFields = encodeFirestoreFields(productData);

        let response;

        if (isEditing) {
            const updateURL =
                `${BASE}/Products/${encodeURIComponent(productId)}` +
                `?key=${API_KEY}`;

            response = await fetch(updateURL, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fields: encodedFields
                })
            });
        } else {
            const createURL =
                `${BASE}/Products?documentId=${encodeURIComponent(productId)}` +
                `&key=${API_KEY}`;

            response = await fetch(createURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fields: encodedFields
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();

            throw new Error(
                errorData.error?.message || "Failed to save product."
            );
        }

        showFormMessage(
            isEditing
                ? "Product updated successfully!"
                : "Product added successfully!",
            "success"
        );

        await loadProducts();
        resetProductForm();

    } catch (error) {
        console.error("Save product error:", error);

        showFormMessage(
            error.message || "Something went wrong.",
            "error"
        );

    } finally {
        saveProductButton.disabled = false;

        saveProductButton.textContent = editingProductId
            ? "Update Product"
            : "Add Product to Store";
    }
});

// ======================================================
// RENDER PRODUCT CARDS
// ======================================================

function renderProducts(products) {
    if (!products.length) {
        productsGrid.innerHTML = `
            <div class="admin-products-loading">
                No products found.
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = products.map(product => {
        const image = getAdminImagePath(getProductImage(product));
        const name = getProductName(product);
        const category = getCategoryName(product);
        const stock = getProductStock(product);
        const price = Number(product.price || 0);

        const stockClass = stock <= 5 ? "low-stock" : "";
        const status = product.status || (stock > 0 ? "active" : "inactive");

        return `
            <article class="admin-product-card">

                <div class="admin-product-image">
                    ${
                        image
                            ? `<img src="${escapeHTML(image)}"
                                    alt="${escapeHTML(name)}"
                                    class="admin-product-img">`
                            : `<div class="no-image">No image added</div>`
                    }
                </div>

                <div class="admin-product-info">

                    <span class="admin-product-category">
                        ${escapeHTML(category)}
                    </span>

                    <h3>${escapeHTML(name)}</h3>

                    <p class="admin-product-description">
                        ${escapeHTML(product.description || "No description available.")}
                    </p>

                    <div class="admin-product-details">
                        <span class="admin-product-price">
                            ${formatMoney(price)}
                        </span>

                        <span class="admin-product-stock ${stockClass}">
                            Stock: ${stock}
                        </span>
                    </div>

                    <span class="admin-product-status ${escapeHTML(status)}">
                        ${escapeHTML(status)}
                    </span>

                    <div class="admin-product-actions">

                        <button
                            type="button"
                            class="edit-product-button"
                            data-id="${escapeHTML(product.id)}">
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-product-button"
                            data-id="${escapeHTML(product.id)}">
                            Delete
                        </button>

                    </div>

                </div>

            </article>
        `;
    }).join("");

    productsGrid.querySelectorAll(".admin-product-img").forEach(img => {
        img.addEventListener("error", () => {
            img.style.display = "none";

            const fallback = document.createElement("div");
            fallback.className = "no-image";
            fallback.textContent = "Image unavailable";

            img.parentElement.appendChild(fallback);
        });
    });
}

// ======================================================
// SEARCH PRODUCTS
// ======================================================

function filterProducts() {
    const searchTerm = productSearch.value.trim().toLowerCase();

    const filteredProducts = existingProducts.filter(product => {
        const name = getProductName(product).toLowerCase();
        const category = getCategoryName(product).toLowerCase();

        return name.includes(searchTerm) || category.includes(searchTerm);
    });

    renderProducts(filteredProducts);
}

productSearch.addEventListener("input", filterProducts);

// ======================================================
// DELETE PRODUCT
// ======================================================

async function deleteProduct(productId) {
    const product = existingProducts.find(p => p.id === productId);

    if (!product) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${getProductName(product)}"?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${BASE}/Products/${encodeURIComponent(productId)}?key=${API_KEY}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            const errorData = await response.json();

            throw new Error(
                errorData.error?.message || "Failed to delete product."
            );
        }

        await loadProducts();

        showFormMessage("Product deleted successfully!", "success");

    } catch (error) {
        console.error("Delete error:", error);
        alert(error.message || "Unable to delete product.");
    }
}

// ======================================================
// GRID CLICK EVENTS
// ======================================================

productsGrid.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-product-button");
    const deleteButton = event.target.closest(".delete-product-button");

    if (editButton) {
        const product = existingProducts.find(
            p => p.id === editButton.dataset.id
        );

        if (product) {
            editProduct(product);
        }
    }

    if (deleteButton) {
        deleteProduct(deleteButton.dataset.id);
    }
});

// ======================================================
// LOAD PRODUCTS
// ======================================================

async function loadProducts() {
    productsGrid.innerHTML = `
        <div class="admin-products-loading">
            Loading products...
        </div>
    `;

    try {
        existingProducts = await fetchProducts();

        existingProducts.sort((a, b) =>
            getProductName(a).localeCompare(getProductName(b))
        );

        updateStatistics(existingProducts);

        filterProducts();

        console.log("Velora Products Loaded:", existingProducts);

    } catch (error) {
        console.error("Products loading error:", error);

        productsGrid.innerHTML = `
            <div class="admin-products-loading">
                Unable to load products from Firebase.
                <br><br>
                ${escapeHTML(error.message)}
            </div>
        `;

        totalProductsElement.textContent = "—";
        totalStockElement.textContent = "—";
        totalCategoriesElement.textContent = "—";
        lowStockElement.textContent = "—";
    }
}

// ======================================================
// ADMIN LOGOUT
// HTML uses onclick="adminLogout()"
// ======================================================

function adminLogout() {
    sessionStorage.removeItem("veloraAdmin");
    sessionStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminLoggedIn");

    window.location.href = "admin-login.html";
}

// ======================================================
// START
// ======================================================

loadProducts();