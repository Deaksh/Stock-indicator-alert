export const createOrder = async (uid, credits) => {
  const response = await fetch("https://stock-indicator-alert-1.onrender.com/create_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: uid, credits: credits }),
  });
  return response.json();
};
