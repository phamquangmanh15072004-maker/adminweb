import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyCVzeqApC92YYD-4eaS9gJDxEpe6BHtDzE",
  authDomain: "gundam-shop-app.firebaseapp.com",
  projectId: "gundam-shop-app",
  storageBucket: "gundam-shop-app.firebasestorage.app",
  messagingSenderId: "722166180360",
  appId: "1:722166180360:web:9ae4aad140248a9110bfbd",
  measurementId: "G-MF1292YNNX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);