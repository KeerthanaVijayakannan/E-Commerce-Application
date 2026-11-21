// ======================================================
// VELORA ADMIN DASHBOARD - FIRESTORE CONNECTION
// ======================================================

const FIREBASE_API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";
const FIREBASE_PROJECT_ID = "e-commerce-b63d7";

const FIRESTORE_BASE =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const recentOrdersBody = document.getElementById("recentOrdersTableBody");

// ------------------------------------------------------
// FIRESTORE FETCH
// ------------------------------------------------------

async function getCollection(collectionName) {
    let allDocuments = [];
    let nextPageToken = "";

    do {
        let url = `${FIRESTORE_BASE}/${collectionName}?pageSize=100`;

        if (nextPageToken) {
            url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        }

        url += `&key=${FIREBASE_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `${collectionName} fetch failed: ${response.status} ${errorText}`
            );
        }

        const data = await response.json();

        if (data.documents) {
            allDocuments.push(...data.documents);
        }

        nextPageToken = data.nextPageToken || "";

    } while (nextPageToken);

    return allDocuments;
}

// ------------------------------------------------------
// FIRESTORE DATA CONVERTER
// ------------------------------------------------------

function convertFirestoreValue(value) {
    if (!value) return null;

    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.nullValue !== undefined) return null;

    if (value.mapValue) {
        const result = {};

        const fields = value.mapValue.fields || {};

        for (const key in fields) {
            result[key] = convertFirestoreValue(fields[key]);
        }

        return result;
    }

    if (value.arrayValue) {
        return (value.arrayValue.values || []).map(convertFirestoreValue);
    }

    if (value.referenceValue) {
        return value.referenceValue;
    }

    return null;
}

function convertDocument(document) {
    const result = {};

    const fields = document.fields || {};

    for (const key in fields) {
        result[key] = convertFirestoreValue(fields[key]);
    }

    result.id = document.name.split("/").pop();

    return result;
}

// ------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------

function getValue(object, possibleKeys) {
    for (const key of possibleKeys) {
        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }

    return null;
}

function getOrderAmount(order) {
    const value = getValue(order, [
        "totalAmount",
        "total",
        "grandTotal",
        "amount",
        "orderTotal",
        "totalPrice",
        "price"
    ]);

    if (typeof value === "number") return value;

    if (typeof value === "string") {
        return Number(value.replace(/[₹,\s]/g, "")) || 0;
    }

    return 0;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ------------------------------------------------------
// UPDATE DASHBOARD STAT CARDS
// ------------------------------------------------------

function updateStatCards(products, orders, customers, revenue) {
    const cards = document.querySelectorAll(".stats-grid .stat-card");

    cards.forEach(card => {
        const labelElement = card.querySelector(".stat-label");

        if (!labelElement) return;

        const label = labelElement.textContent.trim().toLowerCase();

        const valueElement = card.querySelector(
            ".stat-value, .stat-number, h2, h3, strong"
        );

        if (!valueElement) return;

        if (label.includes("product")) {
            valueElement.textContent = products.length.toLocaleString("en-IN");
        }
        else if (label.includes("order")) {
            valueElement.textContent = orders.length.toLocaleString("en-IN");
        }
        else if (label.includes("customer")) {
            valueElement.textContent = customers.toLocaleString("en-IN");
        }
        else if (label.includes("revenue") || label.includes("sales")) {
            valueElement.textContent = formatCurrency(revenue);
        }
    });
}

// ------------------------------------------------------
// RECENT ORDERS TABLE
// ------------------------------------------------------

function displayRecentOrders(orders) {
    if (!recentOrdersBody) {
        console.error("recentOrdersTableBody element not found.");
        return;
    }

    if (orders.length === 0) {
        recentOrdersBody.innerHTML = `
            <tr>
                <td colspan="5" class="table-loading">
                    No orders found.
                </td>
            </tr>
        `;
        return;
    }

    const sortedOrders = [...orders].sort((a, b) => {
        const dateA = new Date(
            a.createdAt || a.orderDate || a.date || 0
        ).getTime();

        const dateB = new Date(
            b.createdAt || b.orderDate || b.date || 0
        ).getTime();

        return dateB - dateA;
    });

    const latestOrders = sortedOrders.slice(0, 5);

    recentOrdersBody.innerHTML = latestOrders.map(order => {
        const orderId = order.orderId || order.id || "—";

        const customerName = getValue(order, [
            "customerName",
            "name",
            "userName",
            "fullName",
            "email"
        ]) || "Customer";

        const date = formatDate(
            order.createdAt || order.orderDate || order.date
        );

        const amount = formatCurrency(getOrderAmount(order));

        const status = String(
            order.status || order.orderStatus || "Pending"
        );

        const safeStatus = status.toLowerCase().replace(/\s+/g, "-");

        return `
            <tr>
                <td class="order-id-cell">#${orderId}</td>
                <td>${customerName}</td>
                <td>${date}</td>
                <td>${amount}</td>
                <td>
                    <span class="status-badge ${safeStatus}">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

// ------------------------------------------------------
// LOAD DASHBOARD
// ------------------------------------------------------

async function loadDashboard() {
    try {
        console.log("Loading Velora dashboard...");

        const [productDocuments, orderDocuments] = await Promise.all([
            getCollection("Products"),
            getCollection("Orders")
        ]);

        const products = productDocuments.map(convertDocument);
        const orders = orderDocuments.map(convertDocument);

        // Count unique customers based on customer/user ID or email.
        const uniqueCustomers = new Set();

        orders.forEach(order => {
            const customerId = getValue(order, [
                "customerId",
                "userId",
                "uid",
                "customerEmail",
                "email"
            ]);

            if (customerId) {
                uniqueCustomers.add(String(customerId).toLowerCase());
            }
        });

        // Revenue calculated from order total fields.
        const revenue = orders.reduce((total, order) => {
            return total + getOrderAmount(order);
        }, 0);

        updateStatCards(
            products,
            orders,
            uniqueCustomers.size,
            revenue
        );

        displayRecentOrders(orders);

        console.log("Dashboard loaded successfully!");
        console.log("Products:", products);
        console.log("Orders:", orders);
        console.log("Customers:", uniqueCustomers.size);
        console.log("Revenue:", revenue);

    } catch (error) {
        console.error("Dashboard loading error:", error);

        if (recentOrdersBody) {
            recentOrdersBody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-loading">
                        Unable to load data. Check Firestore permissions and API key.
                    </td>
                </tr>
            `;
        }
    }
}

// ------------------------------------------------------
// START
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", loadDashboard);