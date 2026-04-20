import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVSd24OZnIwXTlix0Drx9SxPJzDXICUhE",
  authDomain: "steps-planner-e5d6f.firebaseapp.com",
  projectId: "steps-planner-e5d6f",
  storageBucket: "steps-planner-e5d6f.firebasestorage.app",
  messagingSenderId: "645469810750",
  appId: "1:645469810750:web:e0a6922ebd97b2bd5b616f",
  measurementId: "G-NZ80GM19ET"
};

// 파이어베이스 앱 초기화
const app = initializeApp(firebaseConfig);

// 인증 서비스 설정 (Google 로그인 제공자 포함)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore 데이터베이스 설정
export const db = getFirestore(app);
