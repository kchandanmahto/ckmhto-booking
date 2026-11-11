
/* =========================================
   CKMHTO.AI - AI AGENT BOOKING
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const bookingForm = document.getElementById("bookingForm");
    const payButton = document.getElementById("payButton");
    const statusMessage = document.getElementById("statusMessage");

    const API_BASE_URL = "";

    if (!bookingForm || !payButton || !statusMessage) {
        console.error("Booking form elements not found.");
        return;
    }

    console.log("CKMHTO.AI Booking System Initialized.");

    /* STATUS MESSAGE */

    function showStatus(message, type = "info") {
        statusMessage.textContent = message;

        statusMessage.style.color =
            type === "error" ? "#f04438" :
                type === "success" ? "#12b76a" :
                    "#667085";
    }

    /* BUTTON LOADING */

    function setLoading(isLoading, text = "Continue to Payment →") {
        payButton.disabled = isLoading;
        payButton.textContent = isLoading ? "Please wait..." : text;
    }

    /* COLLECT FORM DATA */

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

    /* API REQUEST HELPER */

    async function apiRequest(url, options = {}) {
        const response = await fetch(`${API_BASE_URL}${url}`, options);

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.detail || result.message || `Request failed (${response.status})`
            );
        }

        return result;
    }

    /* CREATE ORDER */

    async function createOrder(bookingData) {
        return await apiRequest("/api/create-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bookingData)
        });
    }

    /* GET PAYMENT CONFIG */

    async function getPaymentConfig() {
        return await apiRequest("/api/config");
    }

    /* VERIFY PAYMENT */

    async function verifyPayment(paymentData) {
        return await apiRequest("/api/verify-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(paymentData)
        });
    }

    /* SUCCESS SCREEN */


    function showSuccess(bookingId, paymentId) {

        const formCard = document.querySelector(".form-card");

        formCard.innerHTML = `
        <div class="success-screen">

            <div class="success-icon-wrapper">
                <div class="success-icon">✓</div>
            </div>

            <span class="success-label">PAYMENT SUCCESSFUL</span>

            <h2>Booking Confirmed!</h2>

            <p class="success-description">
                Thank you for choosing CKMHTO.AI.
                Your payment has been successfully verified.
            </p>

            <div class="success-amount">
                <span>Amount Paid</span>
                <strong>₹499</strong>
                <small>INR · One-time booking fee</small>
            </div>

            <div class="receipt-card">

                <div class="receipt-heading">
                    <strong>Payment Receipt</strong>
                    <span class="verified-badge">✓ Verified</span>
                </div>

                <div class="receipt-row">
                    <span>Booking ID</span>
                    <strong>#${bookingId}</strong>
                </div>

                <div class="receipt-row">
                    <span>Payment ID</span>
                    <strong class="payment-reference">${paymentId}</strong>
                </div>

                <div class="receipt-row">
                    <span>Payment Status</span>
                    <strong class="paid-status">Successful</strong>
                </div>

                <div class="receipt-row">
                    <span>Payment Date</span>
                    <strong>${new Date().toLocaleString("en-IN")}</strong>
                </div>

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

            <a href="/" class="success-home-button">
                Back to Home →
            </a>

        </div>
    `;
    }


    /* OPEN RAZORPAY */

    async function openRazorpayCheckout(bookingData) {

        if (typeof window.Razorpay === "undefined") {
            throw new Error(
                "Razorpay Checkout could not load. Please check your internet connection."
            );
        }

        showStatus("Creating your booking...", "info");

        const order = await createOrder(bookingData);

        const config = await getPaymentConfig();

        if (!config.key_id || !order.order_id || !order.amount) {
            throw new Error("Invalid payment configuration or order details.");
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
                color: "#315efb"
            },

            handler: async function (response) {

                try {
                    showStatus("Payment received. Verifying...", "info");

                    const verification = await verifyPayment({
                        booking_id: order.booking_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    });

                    if (verification.success) {
                        showSuccess(order.booking_id);
                    } else {
                        throw new Error("Payment verification was unsuccessful.");
                    }

                } catch (error) {
                    console.error("Verification Error:", error);

                    showStatus(
                        `${error.message} Payment ID: ${response.razorpay_payment_id}`,
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
                response.error?.description || "Payment failed. Please try again.";

            showStatus(message, "error");
            setLoading(false, "Try Payment Again");
        });

        razorpay.open();
    }

    /* FORM SUBMISSION */

    bookingForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        if (payButton.disabled) return;

        if (!bookingForm.reportValidity()) return;

        const bookingData = getBookingData();

        try {
            setLoading(true);

            showStatus("Preparing your secure payment...", "info");

            await openRazorpayCheckout(bookingData);

        } catch (error) {
            console.error("Booking Error:", error);

            showStatus(error.message || "Something went wrong.", "error");

            setLoading(false);
        }
    });

});
