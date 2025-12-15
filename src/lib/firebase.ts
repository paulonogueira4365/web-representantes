import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAryWJzsVvMiVSQuaEjj8SpezBcHkAjsgE",
  authDomain: "uplab-comercial.firebaseapp.com",
  projectId: "uplab-comercial",
  storageBucket: "uplab-comercial.firebasestorage.app",
  messagingSenderId: "907273602838",
  appId: "1:907273602838:web:06dd570c09a0243da0f237"
};

const app = initializeApp(firebaseConfig);

export async function registrarFCM() {
  const supported = await isSupported();
  if (!supported) {
    throw new Error("FCM não suportado neste navegador");
  }

  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
  });

  if (!token) {
    throw new Error("Não foi possível obter o token FCM");
  }

  return token;
}
