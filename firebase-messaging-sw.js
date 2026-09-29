importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBlZHMI2oOQWB7mlKanbufm6oZGX21Ncro",
  authDomain: "qa-device-bay-ob.firebaseapp.com",
  projectId: "qa-device-bay-ob",
  storageBucket: "qa-device-bay-ob.firebasestorage.app",
  messagingSenderId: "375377198641",
  appId: "1:375377198641:web:dd121b0c03f36216a19f10"
});
firebase.messaging(); // shows notification-payload pushes even when the tab is closed

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('/');
  }));
});
