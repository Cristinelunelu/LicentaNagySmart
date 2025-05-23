import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyD2eMaEgXFGrDWyI-vFEyS5nhxU3JbNCuM",
  authDomain: "licenta-smart-home.firebaseapp.com",
  databaseURL: "https://licenta-smart-home-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "licenta-smart-home",
  storageBucket: "licenta-smart-home.appspot.com",
  messagingSenderId: "8614870112",
  appId: "1:8614870112:web:966038501ed95d1d671705",
  measurementId: "G-ZP7T523PZB"
};


const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

export { db, firebaseApp };

