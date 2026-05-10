import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCim9sJDpoZ_c9TeEMVXzFNwDHzq6CFqXw',
  authDomain: 'sistema-apr.firebaseapp.com',
  projectId: 'sistema-apr',
  storageBucket: 'sistema-apr.firebasestorage.app',
  messagingSenderId: '114464767302',
  appId: '1:114464767302:web:20791fcd6e0b7601d2f947',
  measurementId: 'G-XH0JP677Q6',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});
