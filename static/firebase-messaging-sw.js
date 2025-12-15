importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAryWJzsVvMiVSQuaEjj8SpezBcHkAjsgE",
  authDomain: "uplab-comercial.firebaseapp.com",
  projectId: "uplab-comercial",
  storageBucket: "uplab-comercial.firebasestorage.app",
  messagingSenderId: "907273602838",
  appId: "1:907273602838:web:06dd570c09a0243da0f237"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM] Background message", payload);

  self.registration.showNotification(
    payload.notification?.title || "UPLAB",
    {
      body: payload.notification?.body || "Nova notificação",
      icon: "/icons/icon-192.png"
    }
  );
});
