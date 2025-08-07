import os
import razorpay
from dotenv import load_dotenv
load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
print("Razorpay keys at startup:", RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)  # Add for debugging

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def create_razorpay_order(amount_in_paise, uid, credits_to_buy):
    order = razorpay_client.order.create({
        "amount": amount_in_paise,
        "currency": "INR",
        "payment_capture": 1,
        "notes": {
            "uid": uid,
            "credits": credits_to_buy
        }
    })
    return order

def verify_webhook_signature(payload, signature, secret):
    return razorpay_client.utility.verify_webhook_signature(payload, signature, secret)
