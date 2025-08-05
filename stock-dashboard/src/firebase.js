// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJ09Jc70wyBBzJdeKyFJ83YMMvmIWBIrY",
  authDomain: "stockpro-a976a.firebaseapp.com",
  projectId: "stockpro-a976a",
  storageBucket: "stockpro-a976a.firebasestorage.app",
  messagingSenderId: "919625952894",
  appId: "1:919625952894:web:b371bb82c0a7ccace9322f",
  measurementId: "G-CYKE2P7E51"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { app, analytics, auth };
