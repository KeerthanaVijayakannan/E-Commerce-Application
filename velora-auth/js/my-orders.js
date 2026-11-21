/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const BASE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

const u = JSON.parse(sessionStorage.getItem("veloraUser") || "null");

const host = document.getElementById("ordersContainer");

const stages = [
    "Placed",
    "Confirmed",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered"
];


/* =========================
   FIRESTORE DATA HELPERS
========================= */

function dec(v) {
    if (!v) return "";

    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.timestampValue !== undefined) return v.timestampValue;

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
   HTML ESCAPE HELPER
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
   DATE FORMATTER
========================= */

function fmt(d) {
    try {
        return new Date(d).toLocaleString("en-IN");
    } catch {
        return d || "";
    }
}


/* =========================
   LOAD CUSTOMER ORDERS
========================= */

async function load() {
    if (!u) {
        alert("Please login to view orders.");
        location.href = "login.html";
        return;
    }

    try {
        const r = await fetch(
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
                                    fieldPath: "userId"
                                },
                                op: "EQUAL",
                                value: {
                                    stringValue: u.userId || u.documentId
                                }
                            }
                        }
                    }
                })
            }
        );

        if (!r.ok) {
            throw Error("Orders fetch failed");
        }

        const docs = (await r.json())
            .filter(x => x.document)
            .map(x => ({
                docId: x.document.name.split("/").pop(),
                ...fields(x.document.fields)
            }))
            .sort(
                (a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
            );

        /* Empty Orders */
        if (!docs.length) {
            host.innerHTML = `
                <div class="feature-empty">
                    No orders yet. Your purchases will appear here.
                </div>
            `;

            return;
        }

        /* Render Orders */
        host.innerHTML = docs.map(o => {
            const current = stages.indexOf(o.status);
            const cancelled = o.status === "Cancelled";

            /* Order Items */
            const itemLines = (o.items || [])
                .map(i => `
                    <div class="order-item-line">
                        <span>${esc(i.name)} × ${i.quantity}</span>

                        <span>
                            ₹${Number(i.itemTotal || 0).toLocaleString("en-IN")}
                        </span>
                    </div>
                `)
                .join("");

            return `
                <article class="feature-card">

                    <!-- Order Header -->
                    <div
                        style="
                            display: flex;
                            justify-content: space-between;
                            gap: 15px;
                            flex-wrap: wrap;
                        "
                    >
                        <div>
                            <h2>${esc(o.orderId || o.docId)}</h2>

                            <p class="feature-muted">
                                Placed ${fmt(o.createdAt)}
                            </p>
                        </div>

                        <span class="order-status">
                            ${esc(o.status || "Placed")}
                        </span>
                    </div>

                    <!-- Order Details -->
                    <p>
                        <strong>Total:</strong>
                        ₹${Number(o.total || 0).toLocaleString("en-IN")}

                        ·

                        <strong>Payment:</strong>
                        ${esc(o.paymentMethod || "-")}
                        (${esc(o.paymentStatus || "-")})
                    </p>

                    <!-- Items -->
                    <h3>Items</h3>

                    ${itemLines}

                    <!-- Delivery Address -->
                    <h3>Delivery Address</h3>

                    <p>
                        ${esc(o.address?.fullName)}
                        ·
                        ${esc(o.address?.phone)}
                        <br>

                        ${esc(o.address?.addressLine)}
                        ${
                            o.address?.landmark
                                ? ", " + esc(o.address.landmark)
                                : ""
                        }
                        <br>

                        ${esc(o.address?.city)},
                        ${esc(o.address?.state)}
                        -
                        ${esc(o.address?.pincode)}
                    </p>

                    <!-- Tracking -->
                    <h3>Tracking</h3>

                    ${
                        cancelled
                            ? `
                                <p class="order-status">
                                    Order cancelled
                                </p>
                            `
                            : `
                                <div class="tracking-steps">
                                    ${stages.map((s, i) => `
                                        <span
                                            class="tracking-step ${
                                                current >= i ? "done" : ""
                                            }"
                                        >
                                            ${s}
                                        </span>
                                    `).join("")}
                                </div>
                            `
                    }

                    <!-- Tracking Updates -->
                    <details>
                        <summary>Tracking updates</summary>

                        <div>
                            ${
                                (o.statusHistory || [])
                                    .slice()
                                    .reverse()
                                    .map(h => `
                                        <p>
                                            <strong>
                                                ${esc(h.status)}
                                            </strong>

                                            · ${fmt(h.date)}

                                            <br>

                                            ${esc(h.note || "")}
                                        </p>
                                    `)
                                    .join("")
                                ||
                                `
                                    <p>
                                        ${esc(o.status || "Placed")}
                                        · ${fmt(o.createdAt)}
                                    </p>
                                `
                            }
                        </div>
                    </details>

                </article>
            `;
        }).join("");

    } catch (e) {
        console.error(e);

        host.innerHTML = `
            <div class="feature-empty">
                Unable to load orders right now. Please refresh.
            </div>
        `;
    }
}


/* =========================
   INITIALIZE
========================= */

load();