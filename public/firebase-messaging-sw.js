// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
firebase.initializeApp({
  apiKey: "AIzaSyDGlcpvw4zTeNJKSG1YiTYregI8B4VyfzM",
  authDomain: "gen-lang-client-0701799372.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0701799372-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "gen-lang-client-0701799372",
  storageBucket: "gen-lang-client-0701799372.firebasestorage.app",
  messagingSenderId: "198841776420",
  appId: "1:198841776420:web:6dc825f9d89731a3f95bb1"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'chat-notification',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200], // 진동 패턴 추가
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
