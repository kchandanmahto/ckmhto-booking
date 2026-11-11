
import sqlite3
from pathlib import Path
from contextlib import contextmanager
import json

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "bookings.db"

@contextmanager
def get_db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def init_db():
    with get_db_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                business TEXT NOT NULL,
                service TEXT NOT NULL,
                requirements TEXT NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT DEFAULT 'INR',
                razorpay_order_id TEXT UNIQUE,
                razorpay_payment_id TEXT UNIQUE,
                payment_status TEXT DEFAULT 'pending',
                payment_method TEXT,
                payment_email TEXT,
                payment_contact TEXT,
                payment_bank TEXT,
                payment_wallet TEXT,
                payment_vpa TEXT,
                card_network TEXT,
                card_last4 TEXT,
                failure_reason TEXT,
                paid_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        existing_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(bookings)"
            ).fetchall()
        }

        new_columns = {
            "payment_method": "TEXT",
            "payment_email": "TEXT",
            "payment_contact": "TEXT",
            "payment_bank": "TEXT",
            "payment_wallet": "TEXT",
            "payment_vpa": "TEXT",
            "card_network": "TEXT",
            "card_last4": "TEXT",
            "failure_reason": "TEXT",
            "paid_at": "TEXT",
            "updated_at": "TEXT"
        }

        for column, data_type in new_columns.items():
            if column not in existing_columns:
                connection.execute(
                    f"ALTER TABLE bookings ADD COLUMN {column} {data_type}"
                )

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_booking_status
            ON bookings(payment_status)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_booking_created
            ON bookings(created_at)
        """)

        print("Database initialized successfully.")

def create_booking(data, amount, order_id):
    with get_db_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO bookings (
                name,
                email,
                phone,
                business,
                service,
                requirements,
                amount,
                currency,
                razorpay_order_id,
                payment_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (
            data.name,
            str(data.email),
            data.phone,
            data.business,
            data.service,
            data.requirements,
            amount,
            "INR",
            order_id
        ))

        return cursor.lastrowid

def get_booking_by_id(booking_id):
    with get_db_connection() as connection:
        booking = connection.execute("""
            SELECT *
            FROM bookings
            WHERE id = ?
        """, (booking_id,)).fetchone()

        return dict(booking) if booking else None

def get_booking_by_order_id(order_id):
    with get_db_connection() as connection:
        booking = connection.execute("""
            SELECT *
            FROM bookings
            WHERE razorpay_order_id = ?
        """, (order_id,)).fetchone()

        return dict(booking) if booking else None

def get_booking_by_payment_id(payment_id):
    with get_db_connection() as connection:
        booking = connection.execute("""
            SELECT *
            FROM bookings
            WHERE razorpay_payment_id = ?
        """, (payment_id,)).fetchone()

        return dict(booking) if booking else None

def update_payment_status(
    booking_id,
    payment_id,
    status="paid",
    payment_details=None
):
    details = payment_details or {}

    with get_db_connection() as connection:
        cursor = connection.execute("""
            UPDATE bookings
            SET
                razorpay_payment_id = ?,
                payment_status = ?,
                payment_method = ?,
                payment_email = ?,
                payment_contact = ?,
                payment_bank = ?,
                payment_wallet = ?,
                payment_vpa = ?,
                card_network = ?,
                card_last4 = ?,
                failure_reason = NULL,
                paid_at = CASE
                    WHEN ? = 'paid' THEN CURRENT_TIMESTAMP
                    ELSE paid_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            payment_id,
            status,
            details.get("method"),
            details.get("email"),
            details.get("contact"),
            details.get("bank"),
            details.get("wallet"),
            details.get("vpa"),
            details.get("card_network"),
            details.get("card_last4"),
            status,
            booking_id
        ))

        return cursor.rowcount > 0

def update_payment_failure(booking_id, reason):
    with get_db_connection() as connection:
        cursor = connection.execute("""
            UPDATE bookings
            SET
                payment_status = 'failed',
                failure_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            AND payment_status != 'paid'
        """, (reason, booking_id))

        return cursor.rowcount > 0

def get_all_bookings(limit=100, offset=0, status=None):
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))

    with get_db_connection() as connection:
        if status:
            rows = connection.execute("""
                SELECT *
                FROM bookings
                WHERE payment_status = ?
                ORDER BY id DESC
                LIMIT ? OFFSET ?
            """, (status, limit, offset)).fetchall()
        else:
            rows = connection.execute("""
                SELECT *
                FROM bookings
                ORDER BY id DESC
                LIMIT ? OFFSET ?
            """, (limit, offset)).fetchall()

        return [dict(row) for row in rows]

def get_booking_statistics():
    with get_db_connection() as connection:
        result = connection.execute("""
            SELECT
                COUNT(*) AS total_bookings,
                SUM(
                    CASE WHEN payment_status = 'paid'
                    THEN 1 ELSE 0 END
                ) AS successful_payments,
                SUM(
                    CASE WHEN payment_status = 'pending'
                    THEN 1 ELSE 0 END
                ) AS pending_payments,
                SUM(
                    CASE WHEN payment_status = 'failed'
                    THEN 1 ELSE 0 END
                ) AS failed_payments,
                COALESCE(
                    SUM(
                        CASE WHEN payment_status = 'paid'
                        THEN amount ELSE 0 END
                    ), 0
                ) AS total_revenue
            FROM bookings
        """).fetchone()

        return dict(result)

def get_booking_count():
    with get_db_connection() as connection:
        result = connection.execute("""
            SELECT COUNT(*) AS total
            FROM bookings
        """).fetchone()

        return result["total"]
