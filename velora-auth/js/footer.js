/* =========================
   VELORA GLOBAL FOOTER
========================= */

document.addEventListener("DOMContentLoaded", async function () {

    /* Load footer stylesheet */
    if (!document.querySelector('link[href*="footer.css"]')) {

        const footerStyles = document.createElement("link");

        footerStyles.rel = "stylesheet";
        footerStyles.href = "css/footer.css";

        document.head.appendChild(footerStyles);
    }

    /* Fetch reusable footer */
    try {

        const response = await fetch("footer.html");

        if (!response.ok) {
            throw new Error("Footer file could not be loaded.");
        }

        const footerHTML = await response.text();

        /* Add footer at the end of page */
        document.body.insertAdjacentHTML(
            "beforeend",
            footerHTML
        );

    } catch (error) {

        console.error("Velora footer error:", error);

    }

});