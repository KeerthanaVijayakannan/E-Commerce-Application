
/* =========================================================
   VELORA ADMIN - ORDERS
   Firestore REST API
========================================================= */

const FIREBASE_API_KEY = "PASTE_YOUR_EXISTING_FIREBASE_API_KEY";

const FIRESTORE_BASE =
    "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents";

const ORDERS_COLLECTION = "Orders";

let allOrders = [];

/* =========================================================
   FIRESTORE VALUE DECODER
========================================================= */

function decodeFirestoreValue(value) {

    if (!value) return null;

    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;

    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }

    if ("mapValue" in value) {
        const fields = value.mapValue.fields || {};
        const decoded = {};

        for (const key in fields) {
            decoded[key] = decodeFirestoreValue(fields[key]);
        }

        return decoded;
    }

    return value;
}

function decodeDocument(document) {

    const decoded = {};

    const fields = document.fields || {};

    for (const key in fields) {
        decoded[key] = decodeFirestoreValue(fields[key]);
    }

    decoded.documentId = document.name.split("/").pop();

    return decoded;
}

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function getValue(obj, possibleKeys, fallback = "") {

    for (const key of possibleKeys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
            return obj[key];
        }
    }

    return fallback;
}

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getOrderId(order) {

    return getValue(order, [
        "orderId",
        "id",
        "orderNumber",
        "documentId"
    ], order.documentId);
}

function getCustomerName(order) {

    const customer = order.customer || order.customerDetails || {};

    if (typeof customer === "string") {
        return customer;
    }

    return getValue(order, [
        "customerName",
        "name",
        "fullName",
        "userName",
        "username"
    ]) ||
    getValue(customer, [
        "name",
        "fullName",
        "customerName"
    ], "Unknown Customer");
}

function getCustomerEmail(order) {

    const customer = order.customer || order.customerDetails || {};

    return getValue(order, [
        "email",
        "customerEmail",
        "userEmail"
    ]) ||
    getValue(customer, [
        "email",
        "customerEmail"
    ], "");
}

function getOrderDate(order) {

    return getValue(order, [
        "orderDate",
        "createdAt",
        "date",
        "timestamp",
        "createdOn"
    ], "");
}

function formatOrderDate(value) {

    if (!value) return "N/A";

    let date;

    if (typeof value === "number") {
        date = new Date(value);
    } else {
        date = new Date(value);
    }

    if (isNaN(date.getTime())) return escapeHTML(value);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getOrderItems(order) {

    return getValue(order, [
        "items",
        "products",
        "cartItems",
        "orderItems"
    ], []);
}

function getItemCount(order) {

    const items = getOrderItems(order);

    if (Array.isArray(items)) {
        return items.reduce((total, item) => {
            const quantity = Number(
                item.quantity || item.qty || item.count || 1
            );

            return total + quantity;
        }, 0);
    }

    return 0;
}

function getOrderAmount(order) {

    return Number(getValue(order, [
        "totalAmount",
        "total",
        "grandTotal",
        "amount",
        "orderTotal",
        "price"
    ], 0));
}

function getOrderStatus(order) {

    return getValue(order, [
        "status",
        "orderStatus",
        "paymentStatus"
    ], "Pending");
}

function normalizeStatus(status) {

    const text = String(status).toLowerCase().trim();

    if (text === "pending") return "Pending";
    if (text === "processing") return "Processing";
    if (text === "shipped") return "Shipped";
    if (text === "delivered") return "Delivered";
    if (text === "cancelled" || text === "canceled") return "Cancelled";

    return status || "Pending";
}

/* =========================================================
   FETCH FIRESTORE ORDERS
========================================================= */

async function fetchOrders() {

    const tbody = document.getElementById("ordersTableBody");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="orders-loading">
                    Loading orders from Firebase...
                </td>
            </tr>
        `;
    }

    try {

        let orders = [];
        let nextPageToken = null;

        do {

            let url =
                `${FIRESTORE_BASE}/${ORDERS_COLLECTION}` +
                `?key=${FIREBASE_API_KEY}&pageSize=100`;

            if (nextPageToken) {
                url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const data = await response.json();

            const documents = data.documents || [];

            orders = orders.concat(documents.map(decodeDocument));

            nextPageToken = data.nextPageToken || null;

        } while (nextPageToken);

        allOrders = orders;

        // Latest orders first
        allOrders.sort((a, b) => {
            const dateA = new Date(getOrderDate(a)).getTime() || 0;
            const dateB = new Date(getOrderDate(b)).getTime() || 0;

            return dateB - dateA;
        });

        updateOrderStatistics();
        renderOrders();

    } catch (error) {

        console.error("Orders fetch error:", error);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="orders-loading">
                        Unable to load orders from Firebase.
                        Check your API key and Firestore rules.
                    </td>
                </tr>
            `;
        }
    }
}

/* =========================================================
   ORDER STATISTICS
========================================================= */

function updateOrderStatistics() {

    document.getElementById("ordersTotal").textContent =
        allOrders.length;

    document.getElementById("ordersPending").textContent =
        allOrders.filter(order =>
            normalizeStatus(getOrderStatus(order)) === "Pending"
        ).length;

    document.getElementById("ordersProcessing").textContent =
        allOrders.filter(order =>
            normalizeStatus(getOrderStatus(order)) === "Processing"
        ).length;

    document.getElementById("ordersDelivered").textContent =
        allOrders.filter(order =>
            normalizeStatus(getOrderStatus(order)) === "Delivered"
        ).length;
}

/* =========================================================
   RENDER ORDERS TABLE
========================================================= */

function renderOrders() {

    const tbody = document.getElementById("ordersTableBody");
    const searchInput = document.getElementById("orderSearch");
    const statusFilter = document.getElementById("orderStatusFilter");
    const emptyMessage = document.getElementById("ordersEmptyMessage");

    if (!tbody) return;

    const searchText = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const selectedStatus = statusFilter
        ? statusFilter.value
        : "all";

    const filteredOrders = allOrders.filter(order => {

        const orderId = String(getOrderId(order)).toLowerCase();
        const customerName = getCustomerName(order).toLowerCase();
        const email = getCustomerEmail(order).toLowerCase();

        const status = normalizeStatus(getOrderStatus(order));

        const matchesSearch =
            orderId.includes(searchText) ||
            customerName.includes(searchText) ||
            email.includes(searchText);

        const matchesStatus =
            selectedStatus === "all" ||
            status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    if (filteredOrders.length === 0) {

        tbody.innerHTML = "";

        if (emptyMessage) {
            emptyMessage.style.display = "block";
        }

        return;
    }

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }

    tbody.innerHTML = filteredOrders.map(order => {

        const id = getOrderId(order);
        const customer = getCustomerName(order);
        const email = getCustomerEmail(order);
        const date = formatOrderDate(getOrderDate(order));
        const itemCount = getItemCount(order);
        const amount = getOrderAmount(order);
        const status = normalizeStatus(getOrderStatus(order));

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(id)}</strong>
                </td>

                <td>
                    <strong>${escapeHTML(customer)}</strong>
                    ${email ? `<br><small>${escapeHTML(email)}</small>` : ""}
                </td>

                <td>${escapeHTML(date)}</td>

                <td>${itemCount}</td>

                <td>
                    ₹${amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </td>

                <td>
                    <span class="order-status-badge ${status.toLowerCase()}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td>
                    <select
                        class="order-status-select"
                        onchange="updateOrderStatus('${escapeHTML(id)}', this.value)"
                    >
                        <option value="Pending" ${status === "Pending" ? "selected" : ""}>
                            Pending
                        </option>

                        <option value="Processing" ${status === "Processing" ? "selected" : ""}>
                            Processing
                        </option>

                        <option value="Shipped" ${status === "Shipped" ? "selected" : ""}>
                            Shipped
                        </option>

                        <option value="Delivered" ${status === "Delivered" ? "selected" : ""}>
                            Delivered
                        </option>

                        <option value="Cancelled" ${status === "Cancelled" ? "selected" : ""}>
                            Cancelled
                        </option>
                    </select>
                </td>
            </tr>
        `;

    }).join("");
}

/* =========================================================
   UPDATE ORDER STATUS IN FIRESTORE
========================================================= */

async function updateOrderStatus(orderId, newStatus) {

    const order = allOrders.find(
        item => String(getOrderId(item)) === String(orderId)
    );

    if (!order) return;

    const documentId = order.documentId;

    try {

        const url =
            `${FIRESTORE_BASE}/${ORDERS_COLLECTION}/${documentId}` +
            `?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=status`;

        const response = await fetch(url, {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                fields: {
                    status: {
                        stringValue: newStatus
                    }
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        // Update local data
        order.status = newStatus;

        updateOrderStatistics();
        renderOrders();

        alert("Order status updated successfully!");

    } catch (error) {

        console.error("Status update error:", error);

        alert("Failed to update order status. Check Firestore rules.");

        fetchOrders();
    }
}

/* =========================================================
   SEARCH AND FILTER
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("orderSearch");
    const statusFilter = document.getElementById("orderStatusFilter");

    if (searchInput) {
        searchInput.addEventListener("input", renderOrders);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", renderOrders);
    }

    fetchOrders();

});
