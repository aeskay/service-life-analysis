import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1FY8O7syzdrjKB_YJ1NAG-QkrSOfkxjw",
  authDomain: "service-life-57b9c.firebaseapp.com",
  projectId: "service-life-57b9c",
  storageBucket: "service-life-57b9c.firebasestorage.app",
  messagingSenderId: "405980332357",
  appId: "1:405980332357:web:a63b4309d486bf1e7a3e2c",
  measurementId: "G-RC2DB80VDF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable persistent offline Firestore caching
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export default app;
