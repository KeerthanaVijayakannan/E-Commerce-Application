
/* =========================================================
   VELORA ADMIN - CUSTOMERS
   Customers derived from Firestore Orders collection
========================================================= */

const CUSTOMER_FIREBASE_API_KEY = "PASTE_YOUR_EXISTING_FIREBASE_API_KEY";

const CUSTOMER_FIRESTORE_BASE =
    "https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents";

let customersData = [];

/* FIRESTORE DECODER */

function customerDecodeValue(value) {

    if (!value) return null;

    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;

    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(customerDecodeValue);
    }

    if ("mapValue" in value) {
        const result = {};
        const fields = value.mapValue.fields || {};

        for (const key in fields) {
            result[key] = customerDecodeValue(fields[key]);
        }

        return result;
    }

    return value;
}

function customerDecodeDocument(doc) {

    const result = {};

    for (const key in (doc.fields || {})) {
        result[key] = customerDecodeValue(doc.fields[key]);
    }

    result.documentId = doc.name.split("/").pop();

    return result;
}

/* HELPERS */

function customerGet(obj, keys, fallback = "") {

    if (!obj) return fallback;

    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
            return obj[key];
        }
    }

    return fallback;
}

function customerEscape(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function customerGetDetails(order) {

    const customer =
        order.customer ||
        order.customerDetails ||
        order.user ||
        {};

    const name = typeof customer === "string"
        ? customer
        : customerGet(order, [
            "customerName",
            "name",
            "fullName",
            "userName",
            "username"
        ]) || customerGet(customer, [
            "name",
            "fullName",
            "customerName",
            "userName"
        ], "Guest Customer");

    const email = customerGet(order, [
        "customerEmail",
        "email",
        "userEmail"
    ]) || customerGet(customer, [
        "email",
        "customerEmail"
    ], "");

    const phone = customerGet(order, [
        "phone",
        "customerPhone",
        "phoneNumber",
        "mobile"
    ]) || customerGet(customer, [
        "phone",
        "phoneNumber",
        "mobile",
        "contact"
    ], "");

    const customerId = customerGet(order, [
        "customerId",
        "userId",
        "uid"
    ]) || customerGet(customer, [
        "customerId",
        "userId",
        "uid",
        "id"
    ], "");

    return {
        name,
        email,
        phone,
        customerId
    };
}

function customerGetOrderDate(order) {

    return customerGet(order, [
        "orderDate",
        "createdAt",
        "date",
        "timestamp",
        "createdOn"
    ], "");
}

function customerGetAmount(order) {

    return Number(customerGet(order, [
        "totalAmount",
        "total",
        "grandTotal",
        "amount",
        "orderTotal",
        "price"
    ], 0));
}

function customerFormatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

/* FETCH ORDERS */

async function customerFetchOrders() {

    const tbody = document.getElementById("customersTableBody");

    try {

        let orders = [];
        let nextPageToken = null;

        do {

            let url =
                `${CUSTOMER_FIRESTORE_BASE}/Orders` +
                `?key=${CUSTOMER_FIREBASE_API_KEY}&pageSize=100`;

            if (nextPageToken) {
                url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const data = await response.json();

            orders = orders.concat(
                (data.documents || []).map(customerDecodeDocument)
            );

            nextPageToken = data.nextPageToken || null;

        } while (nextPageToken);

        customersData = customerBuildList(orders);

        customerUpdateStats(orders, customersData);
        customerRenderList();

    } catch (error) {

        console.error("Customer fetch error:", error);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="customers-loading">
                        Failed to load customers from Firebase.
                    </td>
                </tr>
            `;
        }
    }
}

/* BUILD UNIQUE CUSTOMER LIST */

function customerBuildList(orders) {

    const customerMap = new Map();

    orders.forEach(order => {

        const details = customerGetDetails(order);

        const key = (
            details.email ||
            details.customerId ||
            details.phone ||
            details.name
        ).toLowerCase().trim();

        if (!key) return;

        const orderDate = customerGetOrderDate(order);
        const amount = customerGetAmount(order);

        if (!customerMap.has(key)) {

            customerMap.set(key, {
                name: details.name,
                email: details.email,
                phone: details.phone,
                customerId: details.customerId,
                orderCount: 0,
                totalSpent: 0,
                firstOrderDate: orderDate,
                lastOrderDate: orderDate
            });

        }

        const customer = customerMap.get(key);

        customer.orderCount++;
        customer.totalSpent += amount;

        if (orderDate) {

            const newDate = new Date(orderDate).getTime();
            const firstDate = new Date(customer.firstOrderDate || orderDate).getTime();
            const lastDate = new Date(customer.lastOrderDate || orderDate).getTime();

            if (!isNaN(newDate)) {

                if (isNaN(firstDate) || newDate < firstDate) {
                    customer.firstOrderDate = orderDate;
                }

                if (isNaN(lastDate) || newDate > lastDate) {
                    customer.lastOrderDate = orderDate;
                }

            }
        }

        // Fill missing customer information if found in another order
        if (!customer.email && details.email) {
            customer.email = details.email;
        }

        if (!customer.phone && details.phone) {
            customer.phone = details.phone;
        }

        if (
            (!customer.name || customer.name === "Guest Customer") &&
            details.name
        ) {
            customer.name = details.name;
        }

    });

    return Array.from(customerMap.values())
        .sort((a, b) => {
            return new Date(b.lastOrderDate || 0) -
                   new Date(a.lastOrderDate || 0);
        });
}

/* STATISTICS */

function customerUpdateStats(orders, customers) {

    const now = new Date();

    const month = now.getMonth();
    const year = now.getFullYear();

    const newCustomersCount = customers.filter(customer => {

        const date = new Date(customer.firstOrderDate);

        return !isNaN(date.getTime()) &&
            date.getMonth() === month &&
            date.getFullYear() === year;

    }).length;

    const repeatCustomersCount = customers.filter(
        customer => customer.orderCount > 1
    ).length;

    document.getElementById("totalCustomers").textContent =
        customers.length;

    document.getElementById("newCustomers").textContent =
        newCustomersCount;

    document.getElementById("customerTotalOrders").textContent =
        orders.length;

    document.getElementById("repeatCustomers").textContent =
        repeatCustomersCount;
}

/* RENDER TABLE */

function customerRenderList() {

    const tbody = document.getElementById("customersTableBody");
    const search = document.getElementById("customerSearch");
    const count = document.getElementById("customersCount");
    const emptyMessage = document.getElementById("customersEmptyMessage");

    if (!tbody) return;

    const searchText = search
        ? search.value.toLowerCase().trim()
        : "";

    const filtered = customersData.filter(customer => {

        return (
            customer.name.toLowerCase().includes(searchText) ||
            customer.email.toLowerCase().includes(searchText) ||
            customer.phone.toLowerCase().includes(searchText)
        );
    });

    if (count) {
        count.textContent =
            `${filtered.length} customer${filtered.length !== 1 ? "s" : ""}`;
    }

    if (filtered.length === 0) {

        tbody.innerHTML = "";

        if (emptyMessage) {
            emptyMessage.style.display = "block";
        }

        return;
    }

    if (emptyMessage) {
        emptyMessage.style.display = "none";
    }

    tbody.innerHTML = filtered.map(customer => {

        const initials = customer.name
            .split(" ")
            .filter(Boolean)
            .map(word => word.charAt(0))
            .slice(0, 2)
            .join("")
            .toUpperCase();

        return `
            <tr>

                <td>
                    <div class="customer-name-cell">
                        <div class="customer-avatar">
                            ${customerEscape(initials || "C")}
                        </div>

                        <div>
                            <strong>
                                ${customerEscape(customer.name)}
                            </strong>

                            <small>
                                ${customer.customerId
                                    ? "ID: " + customerEscape(customer.customerId)
                                    : "Customer"}
                            </small>
                        </div>
                    </div>
                </td>

                <td>
                    ${customer.email
                        ? customerEscape(customer.email)
                        : "—"}
                </td>

                <td>
                    ${customer.phone
                        ? customerEscape(customer.phone)
                        : "—"}
                </td>

                <td>
                    <span class="customer-orders-pill">
                        ${customer.orderCount}
                    </span>
                </td>

                <td>
                    <strong>
                        ₹${customer.totalSpent.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}
                    </strong>
                </td>

                <td>
                    ${customerFormatDate(customer.lastOrderDate)}
                </td>

            </tr>
        `;

    }).join("");
}

/* SEARCH */

document.addEventListener("DOMContentLoaded", () => {

    const search = document.getElementById("customerSearch");

    if (search) {
        search.addEventListener("input", customerRenderList);
    }

    customerFetchOrders();

});
