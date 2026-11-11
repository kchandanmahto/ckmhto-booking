
import os
import hmac
import hashlib
from pathlib import Path

import razorpay
from dotenv import load_dotenv


# =========================================
# ENVIRONMENT CONFIGURATION
# =========================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

BOOKING_FEE = int(
    os.getenv("BOOKING_FEE_PAISE", "49900")
)


# =========================================
# RAZORPAY CLIENT
# =========================================

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:

    raise RuntimeError(
        "Razorpay credentials missing. Check backend/.env"
    )


razorpay_client = razorpay.Client(
    auth=(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET
    )
)


# =========================================
# CREATE PAYMENT ORDER
# =========================================

def create_payment_order():

    order_data = {
        "amount": BOOKING_FEE,
        "currency": "INR",
        "receipt": "ai_agent_booking",
        "notes": {
            "project": "CKMHTO AI Agent Booking"
        }
    }

    order = razorpay_client.order.create(
        data=order_data
    )

    return order


# =========================================
# VERIFY PAYMENT SIGNATURE
# =========================================

def verify_payment_signature(
    order_id,
    payment_id,
    signature
):

    if not all([order_id, payment_id, signature]):
        return False

    message = f"{order_id}|{payment_id}"

    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        signature
    )


# =========================================
# FETCH PAYMENT DETAILS
# =========================================

def fetch_payment(payment_id):

    return razorpay_client.payment.fetch(
        payment_id
    )


# =========================================
# PUBLIC PAYMENT CONFIGURATION
# =========================================

def get_public_config():

    return {
        "key_id": RAZORPAY_KEY_ID,
        "booking_fee_paise": BOOKING_FEE
    }
