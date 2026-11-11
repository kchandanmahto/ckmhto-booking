
/* =========================================
   CKMHTO.AI - AI AGENT BOOKING
   Navigation + Razorpay + Verified Receipt + PDF
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================
       1. ELEMENTS & CONFIGURATION
    ===================================== */

    const bookingForm = document.getElementById("bookingForm");
    const payButton = document.getElementById("payButton");
    const statusMessage = document.getElementById("statusMessage");
    const siteFooter = document.getElementById("siteFooter");

    const API_BASE_URL = "";

    let currentReceipt = null;

    console.log("CKMHTO.AI System Initialized.");


    /* =====================================
       2. PAGE NAVIGATION
    ===================================== */

    function showPage(pageName, scrollTarget = null) {

        const pages = document.querySelectorAll(".page-view");
        const navLinks = document.querySelectorAll("[data-page-link]");

        let pageExists = false;

        pages.forEach(page => {
            const isActive = page.dataset.page === pageName;

            page.classList.toggle("active", isActive);
            page.classList.toggle("is-hidden", !isActive);

            if (isActive) pageExists = true;
        });

        if (!pageExists) {
            console.error("Page not found:", pageName);
            return;
        }

        // Update active navbar link
        navLinks.forEach(link => {
            const isActive = link.dataset.pageLink === pageName;

            link.classList.toggle("active", isActive);

            if (link.closest(".nav-links")) {
                if (isActive) {
                    link.setAttribute("aria-current", "page");
                } else {
                    link.removeAttribute("aria-current");
                }
            }
        });

        // Footer hidden on Home, visible on other pages
        if (siteFooter) {
            siteFooter.classList.toggle(
                "is-hidden",
                pageName === "home"
            );
        }

        // Scroll to requested section or page top
        requestAnimationFrame(() => {

            if (scrollTarget) {
                const target = document.getElementById(scrollTarget);

                if (target) {
                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                    return;
                }
            }

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        });
    }


    // Handle navbar and internal navigation links
    document.querySelectorAll("[data-page-link]").forEach(link => {

        link.addEventListener("click", event => {

            event.preventDefault();

            const pageName = link.dataset.pageLink;

            // Links that should open Home and scroll to booking
            if (link.hasAttribute("data-scroll-booking")) {
                showPage("home", "booking");
                return;
            }

            // Switch page
            showPage(pageName);

        });

    });


    // Ensure correct initial page visibility
    showPage("home");


    /* =====================================
       3. FORM ELEMENT CHECK
    ===================================== */

    if (!bookingForm || !payButton || !statusMessage) {
        console.error("Booking form elements not found.");
        return;
    }


    /* =====================================
       4. HELPERS
    ===================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }


    function formatDate(date) {
        return date.toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "medium"
        });
    }


    function showStatus(message, type = "info") {

        statusMessage.textContent = message;

        statusMessage.style.color =
            type === "error" ? "#f04438" :
                type === "success" ? "#12b76a" :
                    "#a1aec2";
    }


    function setLoading(isLoading, text = "Continue to Payment →") {

        payButton.disabled = isLoading;

        payButton.textContent = isLoading
            ? "Please wait..."
            : text;
    }


    /* =====================================
       5. COLLECT FORM DATA
    ===================================== */

    function getBookingData() {

        return {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            business: document.getElementById("business").value.trim(),
            service: document.getElementById("service").value,
            requirements: document.getElementById("requirements").value.trim()
        };

    }


    /* =====================================
       6. API REQUEST HELPER
    ===================================== */

    async function apiRequest(url, options = {}) {

        let response;

        try {

            response = await fetch(`${API_BASE_URL}${url}`, options);

        } catch (error) {

            throw new Error(
                "Cannot connect to the server. Check your connection."
            );

        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {

            const detail = result.detail || result.message;

            throw new Error(
                typeof detail === "string"
                    ? detail
                    : `Server request failed (${response.status}).`
            );

        }

        return result;

    }


    /* =====================================
       7. PAYMENT API FUNCTIONS
    ===================================== */

    async function createOrder(bookingData) {

        return apiRequest("/api/create-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bookingData)
        });

    }


    async function getPaymentConfig() {

        return apiRequest("/api/config");

    }


    async function verifyPayment(paymentData) {

        return apiRequest("/api/verify-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(paymentData)
        });

    }


    /* =====================================
       8. RECEIPT HTML
    ===================================== */

    function buildReceiptHTML(receipt) {

        const amount = Number(receipt.amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        return `
            <div class="pdf-receipt">

                <div class="pdf-receipt-header">
                    <h2>CKMHTO<span>.AI</span></h2>
                    <p>Your Business. Powered by AI.</p>
                </div>

                <div class="pdf-receipt-title">
                    <h3>Payment Receipt</h3>
                    <span>PAYMENT VERIFIED</span>
                </div>

                <div class="pdf-receipt-amount">
                    <small>Amount Paid</small>
                    <strong>₹${amount}</strong>
                    <p>INR · AI Service Booking Fee</p>
                </div>

                <div class="pdf-receipt-details">

                    <div>
                        <span>Booking ID</span>
                        <strong>#${escapeHTML(receipt.bookingId)}</strong>
                    </div>

                    <div>
                        <span>Payment ID</span>
                        <strong>${escapeHTML(receipt.paymentId)}</strong>
                    </div>

                    <div>
                        <span>Order ID</span>
                        <strong>${escapeHTML(receipt.orderId)}</strong>
                    </div>

                    <div>
                        <span>Customer</span>
                        <strong>${escapeHTML(receipt.name)}</strong>
                    </div>

                    <div>
                        <span>Email</span>
                        <strong>${escapeHTML(receipt.email)}</strong>
                    </div>

                    <div>
                        <span>Service</span>
                        <strong>${escapeHTML(receipt.service)}</strong>
                    </div>

                    <div>
                        <span>Payment Status</span>
                        <strong class="receipt-paid">Successful</strong>
                    </div>

                    <div>
                        <span>Confirmation Date</span>
                        <strong>${escapeHTML(receipt.date)}</strong>
                    </div>

                </div>

                <div class="pdf-receipt-footer">
                    <p>Thank you for choosing CKMHTO.AI.</p>
                    <small>
                        This receipt confirms verification of your
                        AI service booking payment.
                        Final project pricing is separate.
                    </small>
                </div>

            </div>
        `;

    }


    /* =====================================
       9. DOWNLOAD PDF
    ===================================== */

    async function downloadReceiptPDF() {

        if (!currentReceipt) {
            alert("Receipt is not available.");
            return;
        }

        if (typeof window.html2pdf !== "function") {
            alert("PDF library could not load. Please check your internet.");
            return;
        }

        const button = document.getElementById("downloadReceiptBtn");

        if (button) {
            button.disabled = true;
            button.textContent = "Generating PDF...";
        }

        const wrapper = document.createElement("div");

        wrapper.className = "receipt-export-wrapper";
        wrapper.innerHTML = buildReceiptHTML(currentReceipt);

        document.body.appendChild(wrapper);

        try {

            // Wait for receipt rendering
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            });

            const receiptElement = wrapper.querySelector(".pdf-receipt");

            if (!receiptElement) {
                throw new Error("Receipt element not found.");
            }

            const options = {
                margin: 10,

                filename: `CKMHTO-Receipt-${currentReceipt.bookingId}.pdf`,

                image: {
                    type: "jpeg",
                    quality: 0.98
                },

                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },

                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait"
                },

                pagebreak: {
                    mode: ["avoid-all", "css", "legacy"]
                }
            };

            await window.html2pdf()
                .set(options)
                .from(receiptElement)
                .save();

        } catch (error) {

            console.error("PDF generation failed:", error);

            alert("Could not generate PDF. Please try again.");

        } finally {

            wrapper.remove();

            if (button) {
                button.disabled = false;
                button.textContent = "↓ Download Receipt (PDF)";
            }

        }

    }


    /* =====================================
       10. PRINT RECEIPT
    ===================================== */

    function printReceipt() {

        if (!currentReceipt) return;

        const printWindow = window.open("", "_blank");

        if (!printWindow) {
            alert("Please allow pop-ups to print your receipt.");
            return;
        }

        printWindow.document.open();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">

            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <title>CKMHTO.AI Payment Receipt</title>

                <link rel="stylesheet" href="/static/style.css">

                <style>
                    body {
                        background: #ffffff !important;
                        margin: 0;
                        padding: 20px;
                    }

                    .receipt-export-wrapper {
                        position: static !important;
                        width: 100% !important;
                        min-height: auto !important;
                    }

                    @page {
                        size: A4;
                        margin: 12mm;
                    }
                </style>

            </head>

            <body>

                <div class="receipt-export-wrapper">
                    ${buildReceiptHTML(currentReceipt)}
                </div>

            </body>
            </html>
        `);

        printWindow.document.close();

        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };

    }


    /* =====================================
       11. SUCCESS SCREEN
    ===================================== */

    function showSuccess(receipt) {

        const formCard = document.querySelector(".form-card");

        if (!formCard) return;

        currentReceipt = receipt;

        formCard.innerHTML = `

            <div class="success-screen">

                <div class="success-icon-wrapper">
                    <div class="success-icon">✓</div>
                </div>

                <span class="success-label">
                    PAYMENT SUCCESSFUL
                </span>

                <h2>Booking Confirmed!</h2>

                <p class="success-description">
                    Thank you for choosing CKMHTO.AI.
                    Your payment has been successfully verified.
                </p>

                <div class="success-amount">
                    <span>Amount Paid</span>
                    <strong>
                        ₹${Number(receipt.amount).toLocaleString("en-IN")}
                    </strong>
                    <small>INR · One-time booking fee</small>
                </div>

                <div class="receipt-card">

                    <div class="receipt-heading">
                        <strong>Payment Receipt</strong>
                        <span class="verified-badge">✓ Verified</span>
                    </div>

                    <div class="receipt-row">
                        <span>Booking ID</span>
                        <strong>#${escapeHTML(receipt.bookingId)}</strong>
                    </div>

                    <div class="receipt-row">
                        <span>Payment ID</span>
                        <strong class="payment-reference">
                            ${escapeHTML(receipt.paymentId)}
                        </strong>
                    </div>

                    <div class="receipt-row">
                        <span>Order ID</span>
                        <strong class="payment-reference">
                            ${escapeHTML(receipt.orderId)}
                        </strong>
                    </div>

                    <div class="receipt-row">
                        <span>Payment Status</span>
                        <strong class="paid-status">Successful</strong>
                    </div>

                    <div class="receipt-row">
                        <span>Confirmation Date</span>
                        <strong>${escapeHTML(receipt.date)}</strong>
                    </div>

                </div>

                <div class="receipt-actions">

                    <button type="button" id="downloadReceiptBtn">
                        ↓ Download Receipt (PDF)
                    </button>

                    <button type="button" id="printReceiptBtn">
                        Print Receipt
                    </button>

                </div>

                <div class="next-steps">

                    <div class="next-steps-icon">✉</div>

                    <div>
                        <strong>What's Next?</strong>

                        <p>
                            Our team will review your requirements
                            and contact you regarding the next steps.
                        </p>
                    </div>

                </div>

                <p class="success-footer">
                    Need help? Contact our support team.
                </p>

                <button
                    type="button"
                    class="success-home-button"
                    id="backHomeButton">
                    Back to Home →
                </button>

            </div>

        `;

        // PDF button
        document.getElementById("downloadReceiptBtn")
            .addEventListener("click", downloadReceiptPDF);

        // Print button
        document.getElementById("printReceiptBtn")
            .addEventListener("click", printReceipt);

        // Return to Home without reloading
        document.getElementById("backHomeButton")
            .addEventListener("click", () => {
                showPage("home", "booking");
            });

    }


    /* =====================================
       12. OPEN RAZORPAY CHECKOUT
    ===================================== */

    async function openRazorpayCheckout(bookingData) {

        if (typeof window.Razorpay === "undefined") {
            throw new Error(
                "Razorpay Checkout could not load. Check your internet."
            );
        }

        showStatus("Creating your booking...", "info");

        const order = await createOrder(bookingData);
        const config = await getPaymentConfig();

        if (!config.key_id || !order.order_id || !order.amount) {
            throw new Error(
                "Invalid payment configuration or order details."
            );
        }

        const options = {

            key: config.key_id,

            amount: order.amount,

            currency: order.currency || "INR",

            name: "CKMHTO.AI",

            description: "AI Agent Booking Fee",

            order_id: order.order_id,

            prefill: {
                name: bookingData.name,
                email: bookingData.email,
                contact: bookingData.phone
            },

            theme: {
                color: "#1677ff"
            },

            handler: async function (response) {

                try {

                    showStatus(
                        "Payment received. Verifying...",
                        "info"
                    );

                    const verification = await verifyPayment({

                        booking_id: order.booking_id,

                        razorpay_order_id: response.razorpay_order_id,

                        razorpay_payment_id: response.razorpay_payment_id,

                        razorpay_signature: response.razorpay_signature

                    });

                    if (verification.success !== true) {
                        throw new Error(
                            "Payment verification was unsuccessful."
                        );
                    }

                    if (!response.razorpay_payment_id) {
                        throw new Error("Payment ID was not returned.");
                    }

                    const receipt = {

                        bookingId: order.booking_id,

                        paymentId: response.razorpay_payment_id,

                        orderId: response.razorpay_order_id,

                        amount: Number(order.amount) / 100,

                        name: bookingData.name,

                        email: bookingData.email,

                        service: bookingData.service,

                        date: formatDate(new Date())

                    };

                    showSuccess(receipt);

                } catch (error) {

                    console.error("Verification Error:", error);

                    showStatus(
                        `${error.message} Payment ID: ${response.razorpay_payment_id || "Unavailable"
                        }`,
                        "error"
                    );

                    setLoading(false, "Try Again");

                }

            },

            modal: {

                ondismiss: function () {

                    showStatus(
                        "Payment cancelled. Your booking is not confirmed.",
                        "error"
                    );

                    setLoading(false);

                }

            }

        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", function (response) {

            const message =
                response.error?.description ||
                "Payment failed. Please try again.";

            showStatus(message, "error");

            setLoading(false, "Try Payment Again");

        });

        razorpay.open();

    }


    /* =====================================
       13. FORM SUBMISSION
    ===================================== */

    bookingForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        if (payButton.disabled) return;

        if (!bookingForm.reportValidity()) return;

        const bookingData = getBookingData();

        try {

            setLoading(true);

            showStatus(
                "Preparing your secure payment...",
                "info"
            );

            await openRazorpayCheckout(bookingData);

        } catch (error) {

            console.error("Booking Error:", error);

            showStatus(
                error.message || "Something went wrong.",
                "error"
            );

            setLoading(false);

        }

    });

});
