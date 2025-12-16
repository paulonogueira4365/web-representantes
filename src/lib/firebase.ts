// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 🔒 garante singleton
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Registra o FCM corretamente usando Service Worker
 */
export async function registrarFCM(
  registration: ServiceWorkerRegistration
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("FCM só pode rodar no browser");
  }

  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("Token FCM não gerado");
  }

  return token;
}
