import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';



const firebaseConfig = {
  apiKey: "AIzaSyAZk6akuaFGPgra77pzFbd-LaZIOEhjY2c",
  authDomain: "galaxy-20aec.firebaseapp.com",
  projectId: "galaxy-20aec",
  storageBucket: "galaxy-20aec.firebasestorage.app",
  messagingSenderId: "733706290637",
  appId: "1:733706290637:web:ace1dc9994dac0cbc53084"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
