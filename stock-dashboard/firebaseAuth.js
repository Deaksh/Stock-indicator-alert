import { auth } from "./firebase";  // your firebase.js file
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Register user
export const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

// Login user
export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, password);

// Logout user
export const logoutUser = () => signOut(auth);

// Listen for auth state changes
export const authStateListener = (callback) =>
  onAuthStateChanged(auth, callback);
