/* ==========================================================================
   새뜸초등학교 6학년 라온반 아침 마음 일기 FIREBASE ENGINE (v10 Modular SDK)
   ========================================================================== */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  increment,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Default / Window / LocalStorage / Vercel Environment Variables Firebase Configuration
const getFirebaseConfig = () => {
  // 1. Check if Vercel / Build injected environment variables exist
  if (typeof window !== 'undefined' && window.ENV_FIREBASE_CONFIG) {
    return window.ENV_FIREBASE_CONFIG;
  }

  // 2. Check explicitly saved LocalStorage Config
  const saved = localStorage.getItem('raon_firebase_config');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }

  // 3. Default Saettum Raon Diary Firebase Project Configuration
  return {
    apiKey: "AIzaSyDrKzcsiu454k_56EeJRZG5yOCEJDJZN-U",
    authDomain: "saettum-raon-diary.firebaseapp.com",
    projectId: "saettum-raon-diary",
    storageBucket: "saettum-raon-diary.firebasestorage.app",
    messagingSenderId: "382734329080",
    appId: "1:382734329080:web:338e5b3fc0179ede35c70d"
  };
};

let app, auth, db, provider;
let isFirebaseReady = false;

// Automatic Firebase Services Initialization
function autoInitFirebase() {
  try {
    const config = getFirebaseConfig();
    if (!config.apiKey || config.apiKey === "YOUR_FIREBASE_API_KEY") return false;

    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }

    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    isFirebaseReady = true;
    console.log("🔥 Firebase Engine & Google Auth Provider 100% 준비 완료.");
    return true;
  } catch (err) {
    console.warn("Firebase 자동 초기화 경고:", err.message);
    return false;
  }
}

autoInitFirebase();

// Initialize Firebase Observer Services
export function initFirebaseService(onUserChangedCallback, onClassFeedCallback) {
  if (!isFirebaseReady) autoInitFirebase();

  if (auth && onUserChangedCallback) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const userObj = {
          name: user.displayName || '라온반 학생',
          email: user.email || '',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName || 'Student')}`,
          uid: user.uid,
          isGoogleAuth: true,
          isTeacher: user.email && user.email.toLowerCase() === 'gusals0432@gmail.com'
        };
        onUserChangedCallback(userObj);
      }
    });
  }

  if (isFirebaseReady && onClassFeedCallback) {
    subscribeToDiariesFirestore(onClassFeedCallback);
  }

  return isFirebaseReady;
}

// Google Sign-In with Firebase Auth
export async function loginWithFirebaseGoogle() {
  if (!isFirebaseReady || !auth) {
    throw new Error("Firebase가 아직 설정되지 않았습니다.");
  }
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Sign-Out
export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}

// Save Diary Entry to Firestore `diaries` collection
export async function saveDiaryToFirestore(entryData) {
  if (!isFirebaseReady || !db) return null;

  const docRef = await addDoc(collection(db, "diaries"), {
    ...entryData,
    createdTimestamp: serverTimestamp()
  });

  return docRef.id;
}

// Real-time listener for Class Diaries
export function subscribeToDiariesFirestore(callback) {
  if (!isFirebaseReady || !db) return;

  const q = query(
    collection(db, "diaries"),
    orderBy("createdTimestamp", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(list);
  }, (err) => {
    console.error("Firestore 실시간 구독 오류:", err);
  });
}

// Update Cheer Count in Firestore
export async function addCheerToFirestore(docId) {
  if (!isFirebaseReady || !db) return;
  const docRef = doc(db, "diaries", docId);
  await updateDoc(docRef, {
    cheersCount: increment(1)
  });
}

// Save Teacher Comment in Firestore
export async function saveTeacherCommentToFirestore(docId, commentText) {
  if (!isFirebaseReady || !db) return;
  const docRef = doc(db, "diaries", docId);
  await updateDoc(docRef, {
    teacherComment: commentText
  });
}

// Delete Diary from Firestore
export async function deleteDiaryFromFirestore(docId) {
  if (!isFirebaseReady || !db) return;
  const docRef = doc(db, "diaries", docId);
  await deleteDoc(docRef);
}

// Expose to window for global access
window.RaonFirebase = {
  initFirebaseService,
  loginWithFirebaseGoogle,
  logoutFirebase,
  saveDiaryToFirestore,
  subscribeToDiariesFirestore,
  addCheerToFirestore,
  saveTeacherCommentToFirestore,
  deleteDiaryFromFirestore,
  isReady: () => isFirebaseReady
};
