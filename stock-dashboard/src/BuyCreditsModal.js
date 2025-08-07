import React, { useState, useEffect } from "react";
import { createOrder } from "./services/paymentService";

export default function BuyCreditsModal({ open, onClose, uid, onCreditsUpdated, email = "", contact = "" }) {
  const [loading, setLoading] = useState(false);

  // Dynamically load Razorpay checkout script if not already loaded
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleBuyCredits = async (creditsToBuy = 10) => {
  if (!uid) {
    alert("User ID missing, please log in.");
    return;
  }

  setLoading(true);
  try {
    // Call your payment service which calls backend API
    const data = await createOrder(uid, creditsToBuy);

    // Log full response for debugging
    console.log("Create order response:", data);

    if (!data.order_id) {
      // Display backend error message if available
      throw new Error(data.error || "Failed to create order");
    }

    const options = {
      key: data.key,
      amount: data.amount,
      currency: data.currency,
      order_id: data.order_id,
      handler: async (response) => {
        // Refetch credits and update UI after payment success
        const creditsRes = await fetch(`http://localhost:8000/credits/${uid}`);
        const creditsData = await creditsRes.json();

        if (creditsData.credits !== undefined) {
          onCreditsUpdated(creditsData.credits);
        }

        alert("Payment successful! Credits updated.");
        onClose();
      },
      prefill: {
        email,
        contact,
      },
      theme: { color: "#3557d5" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (error) {
    alert("Payment failed: " + error.message);
  }
  setLoading(false);
};

  if (!open) return null;

  return (
    <div
      style={{
        padding: 20,
        backgroundColor: "white",
        borderRadius: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        maxWidth: 320,
        margin: "40px auto",
        textAlign: "center",
      }}
    >
      <h3>Buy Credits</h3>
      <p>Choose a credit package and complete payment.</p>

      <button
        onClick={() => handleBuyCredits(10)}
        disabled={loading}
        style={{
          padding: "10px 16px",
          fontSize: 16,
          backgroundColor: "#3557d5",
          color: "white",
          borderRadius: 6,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 10,
          width: "100%",
        }}
      >
        {loading ? "Processing..." : "Buy 10 Credits for ₹10"}
      </button>

      <button
        onClick={onClose}
        disabled={loading}
        style={{
          padding: "8px 16px",
          fontSize: 14,
          backgroundColor: "#eee",
          borderRadius: 6,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        Cancel
      </button>
    </div>
  );
}
