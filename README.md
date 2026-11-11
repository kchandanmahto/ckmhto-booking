# CKMHTO.AI — Business Booking Platform

A web-based business booking platform that enables customers to explore digital services, submit project requirements, and pay an initial consultation fee online. It also provides an administrative dashboard to manage bookings, monitor payments, and track business activity.

---

## Overview

**CKMHTO.AI** simplifies the process of connecting businesses with digital service providers through a centralized booking platform.

Customers can browse available services, submit their requirements through an online booking form, and complete the initial booking payment using Razorpay. Administrators can access a dedicated dashboard to review booking information and monitor payment activity.

## Key Features

### Customer Platform
- Responsive and user-friendly interface
- Dedicated service categories
- Online project booking form
- Customer and business information collection
- Project requirement submission
- Razorpay payment integration
- Booking status and payment feedback

### Admin Dashboard
- Dashboard overview and booking statistics
- View and manage customer bookings
- Search and filter booking records
- View individual booking details
- Monitor payment information
- Export booking records to CSV
- Refresh dashboard data

### Payment System
- Razorpay payment gateway integration
- Backend payment order creation
- Payment signature verification
- Payment status updates
- Initial consultation/booking fee handling

---

## Installation & Setup

### Prerequisites

Make sure the following are installed:

- Python 3.10 or higher
- pip
- Git
- Razorpay account for payment integration

### 1. Clone the Repository

```bash
git clone https://github.com/kchandanmahto/ckmhto-booking.git
```

### 2. Navigate to the Project

```bash
cd ckmhto-booking
```

### 3. Create a Virtual Environment

```bash
python -m venv .venv
```

Activate the environment:

**Windows**
```bash
.venv\Scripts\activate
```

**Linux / macOS**
```bash
source .venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install fastapi uvicorn razorpay python-dotenv
```

### 5. Configure Environment Variables

Create a `.env` file in the project root.

Add the Razorpay credentials and admin authentication settings using the exact variable names expected by the backend configuration.

**Important:** Never commit your `.env` file or expose secret credentials publicly.

### 6. Start the Application

Run the following command from the project root:

```bash
uvicorn backend.main:app --reload
```

Open the application:

```text
http://127.0.0.1:8000
```

---

## Security Considerations

- Keep API secrets and credentials in environment variables.
- Never expose Razorpay secret keys in frontend code.
- Verify payment signatures on the backend.
- Protect administrative routes with authentication.
- Do not commit `.env`, database files, or other sensitive information to public repositories.
- Use HTTPS and production-grade configuration before deployment.

---

## Future Improvements

Potential areas for future development:

- Customer booking history
- Email and WhatsApp notifications
- Advanced booking management
- Improved reporting and analytics
- Production deployment enhancements
- Automated customer communication

---

## Developer

**Chandan Kumar**

AI Developer | Full Stack Developer

- GitHub: [@kchandanmahto](https://github.com/kchandanmahto)
- Project Repository: [CKMHTO.AI Booking Platform](https://github.com/kchandanmahto/ckmhto-booking)

---

## License

No license has been specified yet. All rights are reserved by the project owner unless a license is added to this repository.