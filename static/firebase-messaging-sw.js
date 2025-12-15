importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Inicializando o Firebase
firebase.initializeApp({
  apiKey: "AIzaSy...", // Coloque sua chave API aqui
  authDomain: "uplab-comercial.firebaseapp.com",
  projectId: "uplab-comercial",
  messagingSenderId: "907273602838",
  appId: "1:907273602838:web:06dd570c09a0243da0f237"
});

// Obtendo a instância do serviço de mensagens
const messaging = firebase.messaging();

// Adicionando evento de push
self.addEventListener('push', (event) => {
  const payload = event.data.json();  // Pegando o payload do FCM
  const { title, body, icon, click_action } = payload.notification || {};

  // Verificando se os dados necessários estão presentes
  if (title && body) {
    // Mostrando a notificação
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon || '/icons/icon-192.png',  // Definindo ícone padrão
        click_action: click_action || 'https://web-representantes.vercel.app',  // URL padrão
        tag: 'push-notification',
      })
    );
  } else {
    console.error("Payload de notificação inválido:", payload);
  }
});

// Manipulando a ação de clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.click_action || 'https://web-representantes.vercel.app';
  event.waitUntil(clients.openWindow(clickAction));  // Abre a URL quando a notificação é clicada
});
