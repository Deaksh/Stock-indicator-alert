from fastapi import APIRouter, Request, Header, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from .razorpay_integration import create_razorpay_order, verify_webhook_signature, razorpay_client
import json
import os

router = APIRouter()

@router.post("/create_order")
async def create_order(request: Request):
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    uid = data.get("uid")
    credits_to_buy = data.get("credits")
    if not uid or not credits_to_buy:
        raise HTTPException(status_code=400, detail="Missing uid or credits")

    amount_in_paise = credits_to_buy * 100  # your pricing logic here

    try:
        order = create_razorpay_order(amount_in_paise, uid, credits_to_buy)
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key": os.getenv("RAZORPAY_KEY_ID")
        }
    except Exception as e:
        print("Order creation failed:", e)
        raise HTTPException(status_code=500, detail=f"Order creation failed: {e}")



@router.post("/razorpay_webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    payload = await request.body()
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

    try:
        verify_webhook_signature(payload, x_razorpay_signature, webhook_secret)
        event = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {e}")

    if event.get("event") == "payment.captured":
        order_id = event["payload"]["payment"]["entity"]["order_id"]
        order = razorpay_client.order.fetch(order_id)
        uid = order["notes"].get("uid")
        credits_bought = int(order["notes"].get("credits", 0))

        user = db.query(User).filter(User.id == uid).first()
        if user and credits_bought > 0:
            user.credits += credits_bought
            db.commit()

    return {"status": "ok"}
