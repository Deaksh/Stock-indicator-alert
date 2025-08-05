import React from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

export default function LogoutButton() {
  const handleLogout = () => signOut(auth);
  return (
    <button onClick={handleLogout} style={{ padding: 8, fontWeight: "bold" }}>
      Logout
    </button>
  );
}
