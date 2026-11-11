
import os
import hmac
import secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, EmailStr, Field

from database import (
    init_db,
    create_booking,
    get_booking_by_id,
    update_payment_status,
    get_all_bookings,
    get_booking_statistics,
    get_booking_by_payment_id
)

from payment import (
    create_payment_order,
    verify_payment_signature,
    get_public_config,
    fetch_payment
)


# =========================================
# PATH CONFIGURATION
# =========================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

STATIC_DIR = PROJECT_DIR / "static"
ADMIN_DIR = PROJECT_DIR / "admin"
load_dotenv(BASE_DIR / ".env", override=True)


# =========================================
# FASTAPI APPLICATION
# =========================================

app = FastAPI(
    title="CKMHTO AI Agent Booking",
    description="AI Agent Booking and Payment Management API",
    version="2.0.0"
)

security = HTTPBasic()


# =========================================
# ADMIN AUTHENTICATION
# =========================================

def verify_admin(
    credentials: HTTPBasicCredentials = Depends(security)
):

    admin_username = os.getenv("ADMIN_USERNAME")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_username or not admin_password:
        raise HTTPException(
            status_code=503,
            detail="Admin credentials are not configured."
        )

    username_ok = secrets.compare_digest(
        credentials.username.encode("utf-8"),
        admin_username.encode("utf-8")
    )

    password_ok = secrets.compare_digest(
        credentials.password.encode("utf-8"),
        admin_password.encode("utf-8")
    )

    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=401,
            detail="Invalid admin username or password.",
            headers={"WWW-Authenticate": "Basic"}
        )

    return True


# =========================================
# STATIC FILES
# =========================================

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)

if ADMIN_DIR.exists():

    app.mount(
        "/admin-assets",
        StaticFiles(directory=ADMIN_DIR),
        name="admin-assets"
    )


# =========================================
# DATABASE INITIALIZATION
# =========================================

@app.on_event("startup")
def startup_event():
    init_db()


# =========================================
# REQUEST MODELS
# =========================================

class BookingRequest(BaseModel):

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    business: str = Field(min_length=2, max_length=120)
    service: str = Field(min_length=2, max_length=100)
    requirements: str = Field(min_length=10, max_length=2000)


class PaymentVerification(BaseModel):

    booking_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# =========================================
# HOME PAGE
# =========================================

@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


# =========================================
# ADMIN PAGE
# =========================================

@app.get("/admin")
def admin_page():

    if not (ADMIN_DIR / "index.html").exists():
        raise HTTPException(
            status_code=404,
            detail="Admin dashboard is not created yet."
        )

    return FileResponse(ADMIN_DIR / "index.html")


# =========================================
# HEALTH CHECK
# =========================================

@app.get("/api/health")
def health_check():

    return {
        "status": "success",
        "message": "CKMHTO AI Agent Booking API is running"
    }


# =========================================
# PAYMENT CONFIGURATION
# =========================================

@app.get("/api/config")
def payment_config():
    return get_public_config()


# =========================================
# CREATE BOOKING AND PAYMENT ORDER
# =========================================

@app.post("/api/create-order")
def create_order(data: BookingRequest):

    try:

        order = create_payment_order()

        booking_id = create_booking(
            data=data,
            amount=order["amount"],
            order_id=order["id"]
        )

        return {
            "success": True,
            "booking_id": booking_id,
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"]
        }

    except Exception as error:

        print("Booking Error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to create booking. Please try again."
        )


# =========================================
# VERIFY PAYMENT
# =========================================

@app.post("/api/verify-payment")
def verify_payment(data: PaymentVerification):

    booking = get_booking_by_id(data.booking_id)

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found."
        )

    if booking["razorpay_order_id"] != data.razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay order ID."
        )

    # Verify Razorpay signature
    valid_signature = verify_payment_signature(
        order_id=data.razorpay_order_id,
        payment_id=data.razorpay_payment_id,
        signature=data.razorpay_signature
    )

    if not valid_signature:
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed."
        )

    try:
        payment = fetch_payment(data.razorpay_payment_id)

    except Exception as error:

        print("Razorpay Fetch Error:", error)

        raise HTTPException(
            status_code=502,
            detail="Unable to confirm payment with Razorpay."
        )

    # Confirm actual captured payment
    if (
        payment.get("order_id") != data.razorpay_order_id
        or payment.get("amount") != booking["amount"]
        or payment.get("currency") != booking["currency"]
        or payment.get("status") != "captured"
    ):
        raise HTTPException(
            status_code=400,
            detail="Payment details do not match the booking."
        )

    # Prevent duplicate payment ID reuse
    existing_payment = get_booking_by_payment_id(
        data.razorpay_payment_id
    )

    if existing_payment and existing_payment["id"] != data.booking_id:
        raise HTTPException(
            status_code=409,
            detail="Payment ID is already linked to another booking."
        )

    # Prevent overwriting a different successful payment
    if booking["payment_status"] == "paid":

        if booking["razorpay_payment_id"] == data.razorpay_payment_id:
            return {
                "success": True,
                "message": "Payment already verified.",
                "booking_id": data.booking_id
            }

        raise HTTPException(
            status_code=409,
            detail="This booking already has a successful payment."
        )

    card = payment.get("card") or {}

    payment_details = {
        "method": payment.get("method"),
        "email": payment.get("email"),
        "contact": payment.get("contact"),
        "bank": payment.get("bank"),
        "wallet": payment.get("wallet"),
        "vpa": payment.get("vpa"),
        "card_network": card.get("network"),
        "card_last4": card.get("last4")
    }

    updated = update_payment_status(
        booking_id=data.booking_id,
        payment_id=data.razorpay_payment_id,
        status="paid",
        payment_details=payment_details
    )

    if not updated:
        raise HTTPException(
            status_code=500,
            detail="Unable to update booking payment status."
        )

    return {
        "success": True,
        "message": "Payment verified successfully.",
        "booking_id": data.booking_id
    }


# =========================================
# ADMIN: DASHBOARD STATISTICS
# =========================================

@app.get("/api/admin/stats")
def admin_stats(
    authenticated: bool = Depends(verify_admin)
):

    return get_booking_statistics()


# =========================================
# ADMIN: ALL BOOKINGS
# =========================================

@app.get("/api/admin/bookings")
def admin_bookings(
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    authenticated: bool = Depends(verify_admin)
):

    allowed_statuses = {
        "paid",
        "pending",
        "failed"
    }

    if status and status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment status."
        )

    bookings = get_all_bookings(
        limit=limit,
        offset=offset,
        status=status
    )

    return {
        "success": True,
        "total_returned": len(bookings),
        "bookings": bookings
    }


# =========================================
# ADMIN: SINGLE BOOKING DETAILS
# =========================================

@app.get("/api/admin/bookings/{booking_id}")
def admin_booking_details(
    booking_id: int,
    authenticated: bool = Depends(verify_admin)
):

    booking = get_booking_by_id(booking_id)

    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found."
        )

    return {
        "success": True,
        "booking": booking
    }
