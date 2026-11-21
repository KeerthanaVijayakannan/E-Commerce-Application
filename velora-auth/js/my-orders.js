/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const BASE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

const user = JSON.parse(sessionStorage.getItem("veloraUser") || "null");

const ordersContainer = document.getElementById("ordersContainer");
const emptyOrders = document.getElementById("emptyOrders");
const ordersCount = document.getElementById("ordersCount");

let currentOrders = [];


/* =========================
   FIRESTORE DECODER
========================= */

function dec(v) {
    if (!v) return null;

    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.booleanValue !== undefined) return v.booleanValue;

    if (v.timestampValue !== undefined) return v.timestampValue;

    if (v.arrayValue) {
        return (v.arrayValue.values || []).map(dec);
    }

    if (v.mapValue) {
        return fields(v.mapValue.fields);
    }

    return null;
}

function fields(f) {
    const result = {};

    Object.entries(f || {}).forEach(([key, value]) => {
        result[key] = dec(value);
    });

    return result;
}


/* =========================
   FIRESTORE ENCODER
========================= */

function encodeFirestoreValue(value) {

    if (value === null || value === undefined) {
        return { nullValue: null };
    }

    if (typeof value === "string") {
        return { stringValue: value };
    }

    if (typeof value === "boolean") {
        return { booleanValue: value };
    }

    if (typeof value === "number") {
        if (Number.isInteger(value)) {
            return { integerValue: String(value) };
        }

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
        const encodedFields = {};

        Object.entries(value).forEach(([key, val]) => {
            encodedFields[key] = encodeFirestoreValue(val);
        });

        return {
            mapValue: {
                fields: encodedFields
            }
        };
    }

    return { nullValue: null };
}


/* =========================
   HELPERS
========================= */

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ");
}


/* =========================
   ORDER STATUS
========================= */

const trackingStatuses = [
    "Placed",
    "Confirmed",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered"
];

function getStatus(order) {
    return order.status ||
        order.orderStatus ||
        order.trackingStatus ||
        "Placed";
}

function getStatusIndex(status) {
    const s = normalize(status);

    if (s.includes("cancel")) return -1;

    if (s === "pending") return -1;

    if (s.includes("out for delivery")) return 4;
    if (s === "delivered") return 5;
    if (s.includes("ship")) return 3;
    if (s.includes("pack")) return 2;
    if (s.includes("confirm") || s.includes("process")) return 1;
    if (s.includes("place")) return 0;

    return -1;
}

function statusClass(status) {
    const s = normalize(status);

    if (s.includes("cancel")) return "cancelled";
    if (s === "delivered") return "delivered";
    if (s === "pending") return "pending";

    return "";
}


/* =========================
   CANCELLATION ELIGIBILITY
========================= */

function canCancelOrder(status) {
    const s = normalize(status);

    return s === "pending" || s === "placed";
}


/* =========================
   ORDER ITEM HELPERS
========================= */

function getItems(order) {
    const items =
        order.items ||
        order.orderItems ||
        order.products ||
        order.cartItems ||
        [];

    return Array.isArray(items) ? items : [];
}

function getItemName(item) {
    return item.productName ||
        item.name ||
        item.title ||
        item.product ||
        "Product";
}

function getItemPrice(item) {
    return Number(
        item.price ||
        item.unitPrice ||
        item.productPrice ||
        0
    );
}

function getItemQuantity(item) {
    return Number(
        item.quantity ||
        item.qty ||
        1
    );
}

function getOrderTotal(order) {
    return Number(
        order.totalAmount ??
        order.grandTotal ??
        order.orderTotal ??
        order.total ??
        order.amount ??
        order.finalAmount ??
        0
    );
}


/* =========================
   TRACKING TIMELINE
========================= */

function renderTracking(status) {

    const statusText = normalize(status);

    if (statusText.includes("cancel")) {
        return `
            <div class="tracking-cancelled">
                This order has been cancelled.
            </div>
        `;
    }

    if (statusText === "pending") {
        return `
            <div class="tracking-cancelled" style="
                background: #f5eee5;
                color: #987046;
            ">
                Your order is pending confirmation.
                Tracking will be available once your order is confirmed.
            </div>
        `;
    }

    const currentIndex = getStatusIndex(status);

    if (currentIndex === -1) {
        return `
            <div class="tracking-cancelled">
                Tracking information is not available yet.
            </div>
        `;
    }

    return `
        <div class="order-tracking">

            <h3 class="tracking-title">Order tracking</h3>

            <div class="tracking-timeline">

                ${trackingStatuses.map((step, index) => {

                    let stepClass = "";

                    if (index < currentIndex) {
                        stepClass = "completed";
                    } else if (index === currentIndex) {
                        stepClass = "current";
                    }

                    return `
                        <div class="tracking-step ${stepClass}">

                            <div class="tracking-dot"></div>

                            <div class="tracking-step-label">
                                ${esc(step)}
                            </div>

                        </div>
                    `;
                }).join("")}

            </div>

        </div>
    `;
}


/* =========================
   CANCEL ORDER - FIREBASE
========================= */

async function cancelOrder(order, button) {

    const status = getStatus(order);

    if (!canCancelOrder(status)) {
        alert("This order can no longer be cancelled.");
        return;
    }

    const orderId = order.orderId || order.id || "Order";

    const confirmed = confirm(
        `Are you sure you want to cancel order #${orderId}?`
    );

    if (!confirmed) {
        return;
    }

    if (!order.id) {
        alert("Unable to identify this order in Firebase.");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Cancelling...";
    }

    const cancelledAt = new Date().toISOString();

    const updatedHistory = [
        ...(Array.isArray(order.statusHistory)
            ? order.statusHistory
            : []),

        {
            status: "Cancelled",
            timestamp: cancelledAt,
            note: "Order cancelled by customer"
        }
    ];

    try {

        const documentPath =
            `${BASE}/Orders/${encodeURIComponent(order.id)}`;

        const updateUrl =
            `${documentPath}?key=${API_KEY}` +
            `&updateMask.fieldPaths=status` +
            `&updateMask.fieldPaths=statusHistory`;

        const response = await fetch(updateUrl, {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                fields: {
                    status: {
                        stringValue: "Cancelled"
                    },

                    statusHistory: encodeFirestoreValue(updatedHistory)
                }
            })
        });

        if (!response.ok) {

            const errorDetails = await response.text();

            console.error(
                "Firestore cancellation error:",
                errorDetails
            );

            throw new Error("Firebase update failed.");
        }

        /* Firebase successfully updated */

        order.status = "Cancelled";
        order.statusHistory = updatedHistory;

        /* Refresh order cards */

        ordersContainer.innerHTML = currentOrders
            .map(renderOrder)
            .join("");

        alert("Your order has been cancelled successfully.");

    } catch (error) {

        console.error("Cancel order error:", error);

        alert(
            "Unable to cancel your order. Please try again."
        );

        if (button) {
            button.disabled = false;
            button.textContent = "Cancel Order";
        }
    }
}


/* =========================
   RENDER ORDER
========================= */

function renderOrder(order) {

    const status = getStatus(order);

    const orderId = order.orderId ||
        order.id ||
        order.documentId ||
        "Order";

    const orderDate = order.createdAt ||
        order.orderDate ||
        order.date ||
        order.timestamp;

    const paymentMethod = order.paymentMethod ||
        order.paymentType ||
        "Not specified";

    const items = getItems(order);

    return `
        <article class="order-card">

            <!-- ORDER HEADER -->

            <div class="order-card-header">

                <div class="order-header-left">

                    <span class="order-number">
                        Order #${esc(orderId)}
                    </span>

                    <span class="order-date">
                        ${esc(formatDate(orderDate))}
                    </span>

                </div>

                <span class="order-status-badge ${statusClass(status)}">
                    ${esc(status)}
                </span>

            </div>


            <!-- ORDER DETAILS -->

            <div class="order-card-body">

                <div class="order-details-grid">

                    <div class="order-info-box">

                        <p class="order-info-label">
                            Payment method
                        </p>

                        <p class="order-info-value">
                            ${esc(paymentMethod)}
                        </p>

                    </div>

                    <div class="order-info-box">

                        <p class="order-info-label">
                            Items ordered
                        </p>

                        <p class="order-info-value">
                            ${items.reduce((sum, item) =>
                                sum + getItemQuantity(item), 0
                            )}
                        </p>

                    </div>

                    <div class="order-info-box">

                        <p class="order-info-label">
                            Order status
                        </p>

                        <p class="order-info-value">
                            ${esc(status)}
                        </p>

                    </div>

                </div>


                <!-- PRODUCTS -->

                <h3 class="order-items-title">
                    Order items
                </h3>

                <div class="order-items">

                    ${
                        items.length
                            ? items.map(item => `
                                <div class="order-item">

                                    <div class="order-item-info">

                                        <span class="order-item-name">
                                            ${esc(getItemName(item))}
                                        </span>

                                        <span class="order-item-quantity">
                                            Quantity: ${getItemQuantity(item)}
                                        </span>

                                    </div>

                                    <span class="order-item-price">
                                        ${money(
                                            getItemPrice(item) *
                                            getItemQuantity(item)
                                        )}
                                    </span>

                                </div>
                            `).join("")
                            : `
                                <p class="order-item-quantity">
                                    Order item details unavailable.
                                </p>
                            `
                    }

                </div>


                <!-- TRACKING -->

                ${renderTracking(status)}

            </div>


            <!-- ORDER FOOTER -->

            <div class="order-card-footer">

                <div class="order-footer-actions">

                    ${
                        canCancelOrder(status)
                            ? `
                                <button
                                    type="button"
                                    class="cancel-order-btn"
                                    data-cancel-order="${esc(order.id)}"
                                >
                                    Cancel Order
                                </button>
                            `
                            : normalize(status).includes("cancel")
                                ? `
                                    <span class="cancelled-label">
                                        Order Cancelled
                                    </span>
                                `
                                : ""
                    }

                </div>

                <div class="order-total-section">

                    <p class="order-total-label">
                        Total paid / payable
                    </p>

                    <p class="order-payment-info">
                        ${esc(paymentMethod)}
                    </p>

                    <span class="order-total-value">
                        ${money(getOrderTotal(order))}
                    </span>

                </div>

            </div>

        </article>
    `;
}


/* =========================
   FETCH ORDERS BY FIELD
========================= */

async function fetchOrdersByField(fieldName, value) {

    if (!value) return [];

    const response = await fetch(
        `${BASE}:runQuery?key=${API_KEY}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                structuredQuery: {
                    from: [
                        {
                            collectionId: "Orders"
                        }
                    ],

                    where: {
                        fieldFilter: {
                            field: {
                                fieldPath: fieldName
                            },

                            op: "EQUAL",

                            value: {
                                stringValue: String(value)
                            }
                        }
                    }
                }
            })
        }
    );

    if (!response.ok) {

        const errorDetails = await response.text();

        console.error(
            "Firestore query error:",
            errorDetails
        );

        throw new Error("Failed to fetch orders.");
    }

    const result = await response.json();

    return result
        .filter(item => item.document)
        .map(item => ({
            id: item.document.name.split("/").pop(),
            ...fields(item.document.fields)
        }));
}


/* =========================
   LOAD ORDERS FROM FIRESTORE
========================= */

async function loadOrders() {

    if (!user) {
        alert("Please login to view your orders.");
        location.href = "login.html";
        return;
    }

    ordersContainer.innerHTML = `
        <div class="orders-loading">
            Loading your order history...
        </div>
    `;

    try {

        const userId = String(
            user.userId || user.documentId || ""
        ).trim();

        const userEmail = String(
            user.email || ""
        ).trim();

        console.log("Logged-in user:", user);
        console.log("Searching orders for userId:", userId);
        console.log("Searching orders for email:", userEmail);

        let myOrders = [];

        /* First: Fetch using userId */

        if (userId) {
            myOrders = await fetchOrdersByField(
                "userId",
                userId
            );
        }

        /* Fallback: Fetch using customerEmail */

        if (!myOrders.length && userEmail) {

            console.log(
                "No orders found by userId. Trying customerEmail."
            );

            myOrders = await fetchOrdersByField(
                "customerEmail",
                userEmail
            );
        }

        console.log("Orders fetched:", myOrders);


        /* SORT NEWEST FIRST */

        myOrders.sort((a, b) => {

            const dateA = new Date(
                a.createdAt || a.orderDate || a.date || 0
            ).getTime();

            const dateB = new Date(
                b.createdAt || b.orderDate || b.date || 0
            ).getTime();

            return dateB - dateA;
        });


        /* SAVE ORDERS IN MEMORY */

        currentOrders = myOrders;


        /* EMPTY STATE */

        if (!myOrders.length) {

            ordersContainer.style.display = "none";
            emptyOrders.style.display = "block";

            ordersCount.textContent = "0 orders";

            console.log("No orders found for this user.");

            return;
        }


        /* DISPLAY ORDERS */

        emptyOrders.style.display = "none";
        ordersContainer.style.display = "block";

        ordersCount.textContent =
            `${myOrders.length} ${
                myOrders.length === 1 ? "order" : "orders"
            }`;

        ordersContainer.innerHTML = myOrders
            .map(renderOrder)
            .join("");

    } catch (error) {

        console.error("My Orders error:", error);

        ordersContainer.style.display = "block";
        emptyOrders.style.display = "none";

        ordersContainer.innerHTML = `
            <div class="orders-loading">
                Unable to load orders. Please refresh and try again.
            </div>
        `;
    }
}


/* =========================
   NAVIGATION
========================= */

const loginLink = document.getElementById("loginLink");
const profileLink = document.getElementById("profileLink");
const cartButton = document.getElementById("cartButton");
const cartCount = document.getElementById("cartCount");

if (user) {

    if (loginLink) {
        loginLink.style.display = "none";
    }

    if (profileLink) {
        profileLink.style.display = "inline-flex";
    }

} else {

    if (loginLink) {
        loginLink.style.display = "inline-flex";
    }

    if (profileLink) {
        profileLink.style.display = "none";
    }
}


/* =========================
   CART COUNT
========================= */

function updateCartCount() {

    const cart = JSON.parse(
        localStorage.getItem("veloraCart") || "[]"
    );

    const total = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 1),
        0
    );

    if (cartCount) {
        cartCount.textContent = total;
    }
}

if (cartButton) {
    cartButton.onclick = () => {
        location.href = "cart.html";
    };
}

updateCartCount();


/* =========================
   CANCEL ORDER CLICK EVENT
========================= */

ordersContainer.addEventListener("click", function (event) {

    const button = event.target.closest(".cancel-order-btn");

    if (!button) return;

    const orderId = button.dataset.cancelOrder;

    const order = currentOrders.find(
        item => item.id === orderId
    );

    if (!order) {
        alert("Order not found.");
        return;
    }

    cancelOrder(order, button);
});


/* =========================
   INITIALIZE
========================= */

loadOrders();