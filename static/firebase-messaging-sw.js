importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "SUA_API_KEY",
  authDomain: "uplab-comercial.firebaseapp.com",
  projectId: "uplab-comercial",
  storageBucket: "uplab-comercial.firebasestorage.app",
  messagingSenderId: "907273602838",
  appId: "1:907273602838:web:06dd570c09a0243da0f237"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification?.title ?? "Nova notificação",
    {
      body: payload.notification?.body ?? "",
      icon: "/uplab-logo.jpg"
    }
  );
});
