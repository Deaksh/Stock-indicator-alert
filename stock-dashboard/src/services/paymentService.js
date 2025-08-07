export const createOrder = async (uid, credits) => {
  const response = await fetch("http://localhost:8000/payment/create_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: uid, credits: credits }),
  });
  return response.json();
};
