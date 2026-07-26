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
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  increment,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Default / Window / LocalStorage Firebase Configuration
const getFirebaseConfig = () => {
  if (window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;

  const saved = localStorage.getItem('raon_firebase_config');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }

  // Placeholder Config (Replace with your Firebase Console Project Settings)
  return {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "saettum-raon-diary.firebaseapp.com",
    projectId: "saettum-raon-diary",
    storageBucket: "saettum-raon-diary.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
  };
};

let app, auth, db, provider;
let isFirebaseReady = false;

// Initialize Firebase Services
export function initFirebaseService(onUserChangedCallback, onClassFeedCallback) {
  try {
    const config = getFirebaseConfig();
    
    // Check if valid API Key is provided
    if (!config.apiKey || config.apiKey === "YOUR_FIREBASE_API_KEY") {
      console.log("ℹ️ Firebase API Key가 설정되지 않아 스뮬레이션 및 로컬 저장소 모드로 구동됩니다.");
      return false;
    }

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

    // Firebase Auth State Observer
    onAuthStateChanged(auth, (user) => {
      if (onUserChangedCallback) {
        if (user) {
          const userObj = {
            name: user.displayName || '라온반 학생',
            email: user.email || '',
            avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName || 'Student')}`,
            uid: user.uid,
            isGoogleAuth: true,
            isTeacher: user.email && (user.email.includes('teacher') || user.email.includes('admin'))
          };
          onUserChangedCallback(userObj);
        } else {
          onUserChangedCallback(null);
        }
      }
    });

    // Real-time Firestore Subscription for Class Diaries
    if (onClassFeedCallback) {
      subscribeToDiariesFirestore(onClassFeedCallback);
    }

    console.log("🔥 Firebase Auth & Firestore가 성공적으로 연결되었습니다.");
    return true;
  } catch (err) {
    console.warn("Firebase 초기화 중 경고:", err.message);
    return false;
  }
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

// Expose to window for global access
window.RaonFirebase = {
  initFirebaseService,
  loginWithFirebaseGoogle,
  logoutFirebase,
  saveDiaryToFirestore,
  subscribeToDiariesFirestore,
  addCheerToFirestore,
  saveTeacherCommentToFirestore,
  isReady: () => isFirebaseReady
};
