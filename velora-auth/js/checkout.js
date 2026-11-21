/* =========================
   CONFIGURATION
========================= */

const API_KEY = "AIzaSyAbnDfdwRBn8lPhXVw8xDq5MZEb2X0SK5M";

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/e-commerce-b63d7/databases/(default)/documents`;

// Configure your actual store UPI ID here before enabling manual UPI payments.
const STORE_UPI_ID = "CONFIGURE_STORE_UPI_ID";

const user = JSON.parse(sessionStorage.getItem("veloraUser") || "null");
const cart = JSON.parse(localStorage.getItem("veloraCart") || "[]");


/* =========================
   HELPER FUNCTIONS
========================= */

const $ = id => document.getElementById(id);

const str = v => ({
    stringValue: String(v ?? "")
});

const num = v => ({
    doubleValue: Number(v || 0)
});

const map = fields => ({
    mapValue: {
        fields
    }
});

const arr = values => ({
    arrayValue: {
        values
    }
});

function decode(v) {
    if (!v) return "";

    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return Number(v.doubleValue);
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;

    if (v.mapValue) return decodeFields(v.mapValue.fields);

    if (v.arrayValue) {
        return (v.arrayValue.values || []).map(decode);
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
   FIRESTORE QUERY
========================= */

async function queryCollection(collection, userId) {
    const r = await fetch(
        `${FIRESTORE}:runQuery?key=${API_KEY}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                structuredQuery: {
                    from: [
                        {
                            collectionId: collection
                        }
                    ],
                    where: {
                        fieldFilter: {
                            field: {
                                fieldPath: "userId"
                            },
                            op: "EQUAL",
                            value: str(userId)
                        }
                    }
                }
            })
        }
    );

    if (!r.ok) {
        throw Error(`Fetch ${collection} failed`);
    }

    return (await r.json())
        .filter(x => x.document)
        .map(x => ({
            documentId: x.document.name.split("/").pop(),
            ...decodeFields(x.document.fields)
        }));
}


/* =========================
   STATE VARIABLES
========================= */

let products = [];
let addresses = [];
let chosenAddress = null;
let editId = null;

let subtotal = 0;
let shipping = 0;
let total = 0;

let busy = false;


/* =========================
   DOM ELEMENTS
========================= */

const addressSection = $("savedAddressesSection");
const addressCards = $("savedAddresses");

const form = $("addressForm");
const saveBtn = $("saveAddressBtn");
const placeBtn = $("placeOrderBtn");


/* =========================
   PRODUCT HELPERS
========================= */

function getProdName(p) {
    return p.productName ||
        p.name ||
        p.title ||
        p.product_title ||
        "Product";
}

function getPrice(p) {
    return Number(
        p.price ??
        p.productPrice ??
        p.sellingPrice ??
        0
    ) || 0;
}


/* =========================
   ORDER SUMMARY
========================= */

function renderSummary() {
    const host = $("checkoutItems");

    host.innerHTML = "";
    subtotal = 0;

    let unavailable = false;

    if (!cart.length) {
        host.innerHTML = "<p>Your cart is empty.</p>";
        placeBtn.disabled = true;
        return;
    }

    cart.forEach(it => {
        const p = products.find(
            x => x.id === it.productId || x.productId === it.productId
        );

        if (!p) {
            unavailable = true;

            host.insertAdjacentHTML(
                "beforeend",
                "<div class='checkout-item'><p>Unavailable item</p></div>"
            );

            return;
        }

        const q = Math.max(1, Number(it.quantity) || 1);
        const line = getPrice(p) * q;

        subtotal += line;

        host.insertAdjacentHTML(
            "beforeend",
            `
                <div class="checkout-item">
                    <div class="checkout-item-info">
                        <h3>${esc(getProdName(p))}</h3>
                        <p>Qty: ${q}</p>
                    </div>

                    <div class="checkout-item-price">
                        ₹${line.toLocaleString("en-IN")}
                    </div>
                </div>
            `
        );
    });

    shipping = subtotal >= 999 ? 0 : 50;
    total = subtotal + shipping;

    $("checkoutSubtotal").textContent =
        `₹${subtotal.toLocaleString("en-IN")}`;

    $("checkoutShipping").textContent =
        shipping === 0 ? "FREE" : `₹${shipping}`;

    $("checkoutTotal").textContent =
        `₹${total.toLocaleString("en-IN")}`;

    placeBtn.disabled = !chosenAddress || unavailable || busy;
}


/* =========================
   SAVED ADDRESSES
========================= */

function renderAddresses() {
    if (!addresses.length) {
        addressSection.style.display = "none";
        form.style.display = "block";
        return;
    }

    addressSection.style.display = "block";

    if (!editId) {
        form.style.display = "none";
    }

    addressCards.innerHTML = addresses.map(a => `
        <div
            class="saved-address-card ${
                chosenAddress?.documentId === a.documentId ? "selected" : ""
            }"
            data-address="${esc(a.documentId)}"
        >
            <label>
                <input
                    type="radio"
                    name="selectedAddress"
                    ${
                        chosenAddress?.documentId === a.documentId
                            ? "checked"
                            : ""
                    }
                >

                <strong>${esc(a.fullName)}</strong>

                <span class="address-type-badge">
                    ${esc(a.addressType || "Address")}
                </span>
            </label>

            <p>
                ${esc(a.phone)}<br>
                ${esc(a.addressLine)}
                ${a.landmark ? "<br>" + esc(a.landmark) : ""}
                <br>
                ${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}
            </p>

            <div class="saved-address-actions">
                <button type="button" data-edit="${esc(a.documentId)}">
                    Edit
                </button>

                <button type="button" data-delete="${esc(a.documentId)}">
                    Delete
                </button>
            </div>
        </div>
    `).join("");

    /* Select Address */
    addressCards.querySelectorAll("[data-address]").forEach(card => {
        card.onclick = () => {
            if (editId) return;

            chosenAddress = addresses.find(
                a => a.documentId === card.dataset.address
            );

            sessionStorage.setItem(
                "veloraCheckoutAddress",
                JSON.stringify(chosenAddress)
            );

            renderAddresses();
            renderSummary();
        };
    });

    /* Edit Address */
    addressCards.querySelectorAll("[data-edit]").forEach(b => {
        b.onclick = e => {
            e.stopPropagation();

            editAddress(
                addresses.find(a => a.documentId === b.dataset.edit)
            );
        };
    });

    /* Delete Address */
    addressCards.querySelectorAll("[data-delete]").forEach(b => {
        b.onclick = e => {
            e.stopPropagation();

            deleteAddress(
                addresses.find(a => a.documentId === b.dataset.delete)
            );
        };
    });
}


/* =========================
   EDIT ADDRESS
========================= */

function editAddress(a) {
    editId = a.documentId;

    [
        "fullName",
        "phone",
        "addressLine",
        "landmark",
        "city",
        "state",
        "pincode",
        "addressType"
    ].forEach(k => {
        $(k).value = a[k] || "";
    });

    form.style.display = "block";
    saveBtn.textContent = "Update Address";

    addCancel();

    form.scrollIntoView({
        behavior: "smooth"
    });
}


/* =========================
   CANCEL ADDRESS EDIT
========================= */

function addCancel() {
    document.getElementById("cancelAddressEdit")?.remove();

    const b = document.createElement("button");

    b.type = "button";
    b.id = "cancelAddressEdit";
    b.className = "add-address-button";
    b.textContent = "Cancel";

    saveBtn.after(b);

    b.onclick = () => {
        editId = null;

        form.reset();
        form.style.display = "none";

        b.remove();

        saveBtn.textContent = "Save Delivery Address";

        renderAddresses();
    };
}


/* =========================
   DELETE ADDRESS
========================= */

async function deleteAddress(a) {
    if (!confirm("Delete this saved address?")) return;

    const r = await fetch(
        `${FIRESTORE}/Addresses/${a.documentId}?key=${API_KEY}`,
        {
            method: "DELETE"
        }
    );

    if (!r.ok) {
        alert("Could not delete address.");
        return;
    }

    addresses = addresses.filter(
        x => x.documentId !== a.documentId
    );

    if (chosenAddress?.documentId === a.documentId) {
        chosenAddress = addresses[0] || null;

        if (chosenAddress) {
            sessionStorage.setItem(
                "veloraCheckoutAddress",
                JSON.stringify(chosenAddress)
            );
        } else {
            sessionStorage.removeItem("veloraCheckoutAddress");
        }
    }

    renderAddresses();
    renderSummary();
}


/* =========================
   ADD NEW ADDRESS BUTTON
========================= */

$("addNewAddressBtn").onclick = () => {
    editId = null;

    form.reset();
    form.style.display = "block";

    saveBtn.textContent = "Save Delivery Address";

    document.getElementById("cancelAddressEdit")?.remove();

    form.scrollIntoView({
        behavior: "smooth"
    });
};


/* =========================
   SAVE / UPDATE ADDRESS
========================= */

form.addEventListener("submit", async e => {
    e.preventDefault();

    const a = {
        fullName: $("fullName").value.trim(),
        phone: $("phone").value.trim(),
        addressLine: $("addressLine").value.trim(),
        landmark: $("landmark").value.trim(),
        city: $("city").value.trim(),
        state: $("state").value.trim(),
        pincode: $("pincode").value.trim(),
        addressType: $("addressType").value,
        userId: user.userId || user.documentId,
        createdAt: new Date().toISOString()
    };

    if (
        !/^[0-9]{10}$/.test(a.phone) ||
        !/^[0-9]{6}$/.test(a.pincode)
    ) {
        alert("Enter a valid 10-digit phone and 6-digit PIN code.");
        return;
    }

    saveBtn.disabled = true;

    try {
        const fields = {};

        Object.entries(a).forEach(([k, v]) => {
            fields[k] = str(v);
        });

        let r;

        if (editId) {
            const old = addresses.find(
                x => x.documentId === editId
            );

            fields.createdAt = str(old?.createdAt || a.createdAt);

            r = await fetch(
                `${FIRESTORE}/Addresses/${editId}?key=${API_KEY}`,
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

            a.documentId = editId;

        } else {
            r = await fetch(
                `${FIRESTORE}/Addresses?key=${API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fields
                    })
                }
            );

            const doc = await r.json();

            a.documentId = doc.name.split("/").pop();
        }

        if (!r.ok) {
            throw Error("Address save failed");
        }

        if (editId) {
            addresses = addresses.map(
                x => x.documentId === editId ? a : x
            );
        } else {
            addresses.push(a);
        }

        chosenAddress = a;

        sessionStorage.setItem(
            "veloraCheckoutAddress",
            JSON.stringify(a)
        );

        editId = null;

        form.reset();
        form.style.display = "none";

        document.getElementById("cancelAddressEdit")?.remove();

        saveBtn.textContent = "Save Delivery Address";

        renderAddresses();
        renderSummary();

        alert("Address saved.");

    } catch (err) {
        console.error(err);
        alert("Unable to save address.");

    } finally {
        saveBtn.disabled = false;
    }
});


/* =========================
   PAYMENT METHOD
========================= */

$("paymentMethodRadios")?.addEventListener("change", () => {});

document.querySelectorAll('input[name="paymentMethod"]').forEach(r => {
    r.addEventListener("change", () => {
        $("upiInstructions").hidden = r.value !== "UPI Manual";
    });
});


/* =========================
   PLACE ORDER
========================= */

async function placeOrder() {
    if (busy) return;

    if (!chosenAddress) {
        alert("Select or save a delivery address first.");
        return;
    }

    const method =
        document.querySelector('input[name="paymentMethod"]:checked')?.value ||
        "Cash on Delivery";

    if (
        method === "UPI Manual" &&
        STORE_UPI_ID === "CONFIGURE_STORE_UPI_ID"
    ) {
        alert(
            "UPI ID is not configured yet. Choose Cash on Delivery, or set STORE_UPI_ID in js/checkout.js."
        );

        return;
    }

    busy = true;

    placeBtn.disabled = true;
    placeBtn.textContent = "Placing order...";

    try {
        const orderId = "VEL-" + Date.now().toString().slice(-8);
        const createdAt = new Date().toISOString();

        const items = cart.map(it => {
            const p = products.find(
                x => x.id === it.productId || x.productId === it.productId
            );

            return {
                productId: it.productId,
                name: getProdName(p),
                price: getPrice(p),
                quantity: Number(it.quantity) || 1,
                itemTotal: getPrice(p) * (Number(it.quantity) || 1)
            };
        });

        const status = "Placed";

        const orderFields = {
            orderId: str(orderId),
            userId: str(user.userId || user.documentId),
            customerName: str(user.name || chosenAddress.fullName),
            customerEmail: str(user.email || ""),

            items: arr(
                items.map(i => map({
                    productId: str(i.productId),
                    name: str(i.name),
                    price: num(i.price),
                    quantity: num(i.quantity),
                    itemTotal: num(i.itemTotal)
                }))
            ),

            address: map(
                Object.fromEntries(
                    Object.entries(chosenAddress)
                        .filter(([k]) => k !== "documentId")
                        .map(([k, v]) => [k, str(v)])
                )
            ),

            subtotal: num(subtotal),
            shipping: num(shipping),
            total: num(total),

            status: str(status),
            paymentMethod: str(method),

            paymentStatus: str(
                method === "Cash on Delivery"
                    ? "Pay on delivery"
                    : "Pending manual verification"
            ),

            upiReference: str(
                $("upiReference")?.value.trim() || ""
            ),

            createdAt: str(createdAt),

            statusHistory: arr([
                map({
                    status: str(status),
                    date: str(createdAt),
                    note: str("Order placed successfully")
                })
            ])
        };

        /* Save Order to Firestore */
        const response = await fetch(
            `${FIRESTORE}/Orders?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fields: orderFields
                })
            }
        );

        if (!response.ok) {
            console.error(await response.text());
            throw Error("Order save failed");
        }

        const saved = await response.json();

        /* Store Last Order */
        sessionStorage.setItem(
            "veloraLastOrder",
            JSON.stringify({
                documentId: saved.name.split("/").pop(),
                orderId,
                userId: user.userId || user.documentId,
                items,
                address: chosenAddress,
                subtotal,
                shipping,
                total,
                status,
                paymentMethod: method,

                paymentStatus:
                    method === "Cash on Delivery"
                        ? "Pay on delivery"
                        : "Pending manual verification",

                createdAt
            })
        );

        /* Clear Local Cart */
        localStorage.removeItem("veloraCart");

        /* Sync Cart Cleanup with Firestore */
        try {
            await fetch(
                `${FIRESTORE}/Carts/${user.userId || user.documentId}?key=${API_KEY}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fields: {
                            items: arr([]),
                            updatedAt: str(new Date().toISOString())
                        }
                    })
                }
            );

        } catch (e) {
            console.warn("Cart sync cleanup failed", e);
        }

        /* Redirect to Success Page */
        location.href = "order-success.html";

    } catch (err) {
        console.error(err);

        alert("Order failed to save. Please try again.");

        busy = false;
        placeBtn.disabled = false;
        placeBtn.textContent = "Place Order";
    }
}


/* =========================
   PLACE ORDER BUTTON
========================= */

placeBtn.addEventListener("click", placeOrder);


/* =========================
   INITIALIZATION
========================= */

async function init() {
    if (!user) {
        alert("Please log in to checkout.");
        location.href = "login.html";
        return;
    }

    try {
        /* Load Products */
        const pr = await fetch(
            `${FIRESTORE}/Products?pageSize=1000&key=${API_KEY}`
        );

        if (!pr.ok) {
            throw Error("Products load error");
        }

        products = (await pr.json()).documents || [];

        products = products.map(d => ({
            id: d.name.split("/").pop(),
            ...decodeFields(d.fields)
        }));

        renderSummary();

        /* Load User Addresses */
        addresses = await queryCollection(
            "Addresses",
            user.userId || user.documentId
        );

        /* Restore Previously Selected Address */
        const saved = JSON.parse(
            sessionStorage.getItem("veloraCheckoutAddress") || "null"
        );

        chosenAddress = saved
            ? addresses.find(x => x.documentId === saved.documentId) || null
            : addresses[0] || null;

        renderAddresses();
        renderSummary();

    } catch (e) {
        console.error(e);

        alert("Checkout data failed to load. Refresh and try again.");
    }
}


/* =========================
   START CHECKOUT
========================= */

init();