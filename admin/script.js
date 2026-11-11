
document.addEventListener("DOMContentLoaded", () => {
    const totalBookingsEl = document.getElementById("totalBookings");
    const totalRevenueEl = document.getElementById("totalRevenue");
    const successfulPaymentsEl = document.getElementById("successfulPayments");
    const pendingPaymentsEl = document.getElementById("pendingPayments");
    const failedPaymentsEl = document.getElementById("failedPayments");
    const bookingsTableBody = document.getElementById("bookingsTableBody");
    const bookingCountEl = document.getElementById("bookingCount");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const refreshButton = document.getElementById("refreshButton");
    const exportButton = document.getElementById("exportButton");
    const bookingModal = document.getElementById("bookingModal");
    const bookingDetails = document.getElementById("bookingDetails");
    const closeModal = document.getElementById("closeModal");
    const toastMessage = document.getElementById("toastMessage");

    let adminCredentials = null;

    function getAuthorizationHeader() {
        if (!adminCredentials) {
            const username = window.prompt("Enter Admin Username:");

            if (username === null) {
                throw new Error("Admin login cancelled.");
            }

            const password = window.prompt("Enter Admin Password:");

            if (password === null) {
                throw new Error("Admin login cancelled.");
            }

            if (!username.trim() || !password) {
                throw new Error("Username and password are required.");
            }

            adminCredentials = {
                username: username.trim(),
                password: password
            };
        }

        return "Basic " + btoa(
            adminCredentials.username + ":" + adminCredentials.password
        );
    }

    async function apiRequest(url, retry = true) {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": getAuthorizationHeader(),
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (response.status === 401 && retry) {
            adminCredentials = null;
            return apiRequest(url, false);
        }

        if (response.status === 401) {
            adminCredentials = null;
            throw new Error("Invalid admin credentials.");
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.detail || "Unable to load dashboard data."
            );
        }

        return result;
    }

    let toastTimer;

    function showToast(message) {
        toastMessage.textContent = message;
        toastMessage.classList.remove("hidden");
        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toastMessage.classList.add("hidden");
        }, 3500);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format((Number(amount) || 0) / 100);
    }

    function formatDate(dateValue) {
        if (!dateValue) return "—";

        const date = new Date(
            dateValue.includes("Z") ? dateValue : dateValue.replace(" ", "T") + "Z"
        );

        if (Number.isNaN(date.getTime())) return dateValue;

        return date.toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    let allBookings = [];

    async function loadStatistics() {
        const stats = await apiRequest("/api/admin/stats");

        totalBookingsEl.textContent = stats.total_bookings ?? 0;
        totalRevenueEl.textContent = formatCurrency(stats.total_revenue);
        successfulPaymentsEl.textContent = stats.successful_payments ?? 0;
        pendingPaymentsEl.textContent = stats.pending_payments ?? 0;
        failedPaymentsEl.textContent = stats.failed_payments ?? 0;
    }

    async function loadBookings() {
        bookingsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Loading bookings...
                </td>
            </tr>
        `;

        const result = await apiRequest(
            "/api/admin/bookings?limit=500&offset=0"
        );

        allBookings = result.bookings || [];
        renderBookings();
    }

    function renderBookings() {
        const searchTerm = searchInput.value
            .trim()
            .toLowerCase();

        const selectedStatus = statusFilter.value;

        const filteredBookings = allBookings.filter(booking => {
            const searchableText = [
                booking.id,
                booking.name,
                booking.email,
                booking.phone,
                booking.business,
                booking.service,
                booking.razorpay_order_id,
                booking.razorpay_payment_id
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(searchTerm);

            const matchesStatus =
                !selectedStatus ||
                booking.payment_status === selectedStatus;

            return matchesSearch && matchesStatus;
        });

        if (filteredBookings.length === 0) {
            bookingsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        No bookings found.
                    </td>
                </tr>
            `;

            bookingCountEl.textContent = "0 records found";
            return;
        }

        bookingsTableBody.innerHTML = filteredBookings.map(booking => {
            const status = ["paid", "pending", "failed"].includes(
                booking.payment_status
            ) ? booking.payment_status : "pending";

            return `
                <tr>
                    <td>
                        <strong>#${escapeHTML(booking.id)}</strong>
                    </td>
                    <td>
                        <strong>${escapeHTML(booking.name)}</strong>
                        <br>
                        <small>${escapeHTML(booking.email)}</small>
                    </td>
                    <td>${escapeHTML(booking.business)}</td>
                    <td>${escapeHTML(booking.service)}</td>
                    <td>
                        <strong>${formatCurrency(booking.amount)}</strong>
                    </td>
                    <td>
                        <span class="payment-badge ${status}">
                            ${status}
                        </span>
                    </td>
                    <td>${escapeHTML(formatDate(booking.created_at))}</td>
                    <td>
                        <button
                            class="view-button"
                            data-booking-id="${Number(booking.id)}"
                        >
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        bookingCountEl.textContent =
            `${filteredBookings.length} of ${allBookings.length} records`;
    }

    async function openBookingDetails(bookingId) {
        bookingModal.classList.remove("hidden");
        bookingDetails.textContent = "Loading booking details...";

        try {
            const result = await apiRequest(
                `/api/admin/bookings/${bookingId}`
            );

            const booking = result.booking;

            const details = [
                ["Booking ID", `#${booking.id}`],
                ["Customer Name", booking.name],
                ["Email", booking.email],
                ["Phone", booking.phone],
                ["Business", booking.business],
                ["Service", booking.service],
                ["Requirements", booking.requirements],
                ["Booking Amount", formatCurrency(booking.amount)],
                ["Currency", booking.currency],
                ["Payment Status", booking.payment_status],
                ["Razorpay Order ID", booking.razorpay_order_id],
                ["Razorpay Payment ID", booking.razorpay_payment_id],
                ["Payment Method", booking.payment_method],
                ["Payment Email", booking.payment_email],
                ["Payment Contact", booking.payment_contact],
                ["Bank", booking.payment_bank],
                ["Wallet", booking.payment_wallet],
                ["UPI VPA", booking.payment_vpa],
                ["Card Network", booking.card_network],
                ["Card Last 4 Digits", booking.card_last4],
                ["Failure Reason", booking.failure_reason],
                ["Payment Date", formatDate(booking.paid_at)],
                ["Booking Created", formatDate(booking.created_at)]
            ];

            bookingDetails.innerHTML = details.map(([label, value]) => {
                const isLongText = [
                    "Requirements",
                    "Razorpay Order ID",
                    "Razorpay Payment ID"
                ].includes(label);

                return `
                    <div class="detail-item ${isLongText ? "full-width" : ""}">
                        <span>${escapeHTML(label)}</span>
                        <strong>${escapeHTML(value || "Not available")}</strong>
                    </div>
                `;
            }).join("");
        } catch (error) {
            bookingDetails.textContent = error.message;
            showToast(error.message);
        }
    }

    function csvCell(value) {
        let text = String(value ?? "");

        if (/^[\s]*[=+\-@]/.test(text)) {
            text = "'" + text;
        }

        return `"${text.replace(/"/g, '""')}"`;
    }

    function exportCSV() {
        if (allBookings.length === 0) {
            showToast("No booking records available.");
            return;
        }

        const headers = [
            "Booking ID",
            "Customer Name",
            "Email",
            "Phone",
            "Business",
            "Service",
            "Requirements",
            "Amount Paise",
            "Currency",
            "Payment Status",
            "Order ID",
            "Payment ID",
            "Payment Method",
            "Payment Email",
            "Payment Contact",
            "Bank",
            "Wallet",
            "UPI VPA",
            "Card Network",
            "Card Last 4",
            "Failure Reason",
            "Paid At",
            "Created At"
        ];

        const rows = allBookings.map(booking => [
            booking.id,
            booking.name,
            booking.email,
            booking.phone,
            booking.business,
            booking.service,
            booking.requirements,
            booking.amount,
            booking.currency,
            booking.payment_status,
            booking.razorpay_order_id,
            booking.razorpay_payment_id,
            booking.payment_method,
            booking.payment_email,
            booking.payment_contact,
            booking.payment_bank,
            booking.payment_wallet,
            booking.payment_vpa,
            booking.card_network,
            booking.card_last4,
            booking.failure_reason,
            booking.paid_at,
            booking.created_at
        ]);

        const csvContent = [
            headers,
            ...rows
        ].map(row => row.map(csvCell).join(",")).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "ckmhto-bookings.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
        showToast("CSV exported successfully.");
    }

    async function refreshDashboard() {
        refreshButton.disabled = true;
        refreshButton.textContent = "Refreshing...";

        try {
            await Promise.all([
                loadStatistics(),
                loadBookings()
            ]);

            showToast("Dashboard updated successfully.");
        } catch (error) {
            console.error("Dashboard Error:", error);
            showToast(error.message);
        } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Refresh";
        }
    }

    searchInput.addEventListener("input", renderBookings);
    statusFilter.addEventListener("change", renderBookings);
    refreshButton.addEventListener("click", refreshDashboard);
    exportButton.addEventListener("click", exportCSV);

    bookingsTableBody.addEventListener("click", event => {
        const button = event.target.closest("[data-booking-id]");

        if (!button) return;

        openBookingDetails(button.dataset.bookingId);
    });

    closeModal.addEventListener("click", () => {
        bookingModal.classList.add("hidden");
    });

    bookingModal.addEventListener("click", event => {
        if (event.target === bookingModal) {
            bookingModal.classList.add("hidden");
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            bookingModal.classList.add("hidden");
        }
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });

    refreshDashboard();
});
