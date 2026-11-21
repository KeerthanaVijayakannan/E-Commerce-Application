/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const BASE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

const u = JSON.parse(sessionStorage.getItem("veloraUser") || "null");

const host = document.getElementById("wishlistGrid");
const emptyWishlist = document.getElementById("emptyWishlist");
const wishlistCount = document.getElementById("wishlistCount");


/* =========================
   FIRESTORE HELPERS
========================= */

function dec(v) {
    if (!v) return "";

    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.booleanValue !== undefined) return v.booleanValue;

    if (v.arrayValue) {
        return (v.arrayValue.values || []).map(dec);
    }

    if (v.mapValue) {
        return fields(v.mapValue.fields);
    }

    return "";
}

function fields(f) {
    const o = {};

    Object.entries(f || {}).forEach(([k, v]) => {
        o[k] = dec(v);
    });

    return o;
}


/* =========================
   HTML ESCAPE
========================= */

function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[c]));
}


/* =========================
   GET PRODUCT IMAGE
========================= */

function getProductImage(p) {
    const possibleImages = [
        p.imageUrl,
        p.imageURL,
        p.image,
        p.productImage,
        p.productImageUrl,
        p.photo,
        p.thumbnail,
        p.img,
        p.images
    ];

    for (const item of possibleImages) {
        if (typeof item === "string" && item.trim()) {
            return item.trim();
        }

        if (Array.isArray(item) && item.length) {
            const first = item[0];

            if (typeof first === "string") {
                return first;
            }

            if (first?.url) return first.url;
            if (first?.imageUrl) return first.imageUrl;
        }
    }

    return "";
}


/* =========================
   LOAD WISHLIST
========================= */

async function load() {
    if (!u) {
        alert("Login to view your wishlist.");
        location.href = "login.html";
        return;
    }

    host.innerHTML = `<div class="wishlist-loading">Loading your favourites...</div>`;

    try {
        const userId = u.userId || u.documentId;

        const [wr, pr] = await Promise.all([
            fetch(`${BASE}/Wishlists/${userId}?key=${API_KEY}`),
            fetch(`${BASE}/Products?pageSize=1000&key=${API_KEY}`)
        ]);

        const wd = wr.ok ? await wr.json() : {};
        const pd = pr.ok ? await pr.json() : { documents: [] };

        const ids = (dec(wd.fields?.items) || [])
            .map(x => x.productId);

        const products = (pd.documents || []).map(d => ({
            id: d.name.split("/").pop(),
            ...fields(d.fields)
        }));

        const matches = ids
            .map(id => products.find(p =>
                p.productId === id || p.id === id
            ))
            .filter(Boolean);

        /* =========================
           EMPTY WISHLIST
        ========================= */

        if (!matches.length) {
            host.innerHTML = "";
            host.style.display = "none";

            if (emptyWishlist) {
                emptyWishlist.style.display = "block";
            }

            if (wishlistCount) {
                wishlistCount.textContent = "0 items saved";
            }

            return;
        }

        /* =========================
           SHOW WISHLIST
        ========================= */

        host.style.display = "grid";

        if (emptyWishlist) {
            emptyWishlist.style.display = "none";
        }

        if (wishlistCount) {
            wishlistCount.textContent =
                `${matches.length} ${matches.length === 1 ? "item" : "items"} saved`;
        }

        /* =========================
           RENDER PRODUCT CARDS
        ========================= */

        host.innerHTML = matches.map(p => {
            const productId = p.productId || p.id;
            const image = getProductImage(p);

            return `
                <article class="wishlist-card">

                    <div class="wishlist-card-image">

                        ${
                            image
                                ? `<img 
                                    src="${esc(image)}"
                                    alt="${esc(p.productName || p.name || "Product")}"
                                    class="wishlist-product-image"
                                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                                >`
                                : ""
                        }

                        <div class="wishlist-image-placeholder"
                            style="${image ? "display:none;" : "display:flex;"}">
                            <span>VELORA</span>
                        </div>

                        <button 
                            class="wishlist-remove-icon"
                            data-remove="${esc(productId)}"
                            title="Remove from wishlist"
                            aria-label="Remove from wishlist"
                        >♡</button>

                    </div>

                    <div class="wishlist-card-details">

                        <p class="wishlist-product-category">
                            ${esc(p.categoryId || "Collection")}
                        </p>

                        <h3 class="wishlist-product-name">
                            ${esc(p.productName || p.name || "Product")}
                        </h3>

                        <p class="wishlist-product-description">
                            ${esc(p.description || "")}
                        </p>

                        <div class="wishlist-card-bottom">

                            <strong class="wishlist-product-price">
                                ₹${Number(p.price || 0).toLocaleString("en-IN")}
                            </strong>

                            <button
                                class="wishlist-add-cart"
                                data-cart="${esc(productId)}"
                            >
                                Add to Cart
                            </button>

                        </div>

                    </div>

                </article>
            `;
        }).join("");

        /* =========================
           ADD TO CART
        ========================= */

        host.querySelectorAll("[data-cart]").forEach(button => {
            button.onclick = () => {
                let cart = JSON.parse(
                    localStorage.getItem("veloraCart") || "[]"
                );

                const productId = button.dataset.cart;

                const existing = cart.find(
                    item => item.productId === productId
                );

                if (existing) {
                    existing.quantity = (existing.quantity || 1) + 1;
                } else {
                    cart.push({
                        productId: productId,
                        quantity: 1
                    });
                }

                localStorage.setItem(
                    "veloraCart",
                    JSON.stringify(cart)
                );

                button.textContent = "Added ✓";

                setTimeout(() => {
                    button.textContent = "Add to Cart";
                }, 1200);
            };
        });

        /* =========================
           REMOVE FROM WISHLIST
        ========================= */

        host.querySelectorAll("[data-remove]").forEach(button => {
            button.onclick = async () => {
                const productId = button.dataset.remove;

                const updatedIds = ids.filter(id => id !== productId);

                const firestoreFields = {
                    userId: {
                        stringValue: userId
                    },

                    items: {
                        arrayValue: {
                            values: updatedIds.map(id => ({
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

                const response = await fetch(
                    `${BASE}/Wishlists/${userId}?key=${API_KEY}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            fields: firestoreFields
                        })
                    }
                );

                if (response.ok) {
                    load();
                } else {
                    alert("Could not remove this product. Please retry.");
                }
            };
        });

    } catch (error) {
        console.error("Wishlist error:", error);

        host.innerHTML = `
            <div class="wishlist-loading">
                Could not load wishlist. Please refresh and try again.
            </div>
        `;
    }
}


/* =========================
   INITIALIZE
========================= */

load();