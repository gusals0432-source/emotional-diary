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

let activeFeedCallback = null;

// Initialize Firebase Observer Services
export function initFirebaseService(onUserChangedCallback, onClassFeedCallback) {
  if (!isFirebaseReady) autoInitFirebase();

  if (onClassFeedCallback) {
    activeFeedCallback = onClassFeedCallback;
  }

  if (auth) {
    onAuthStateChanged(auth, (user) => {
      if (user && onUserChangedCallback) {
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
      // Re-trigger live subscription upon auth state change
      if (activeFeedCallback) {
        subscribeToDiariesFirestore(activeFeedCallback);
      }
    });
  }

  if (isFirebaseReady && activeFeedCallback) {
    subscribeToDiariesFirestore(activeFeedCallback);
  }

  return isFirebaseReady;
}

// Google Sign-In with Firebase Auth
export async function loginWithFirebaseGoogle() {
  if (!isFirebaseReady || !auth) {
    throw new Error("Firebase가 아직 설정되지 않았습니다.");
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/unauthorized-domain') {
      const currentHost = window.location.hostname;
      alert(`⚠️ [Firebase 도메인 승인 필요]\n현재 접속 주소(${currentHost})가 Firebase 승인 도메인에 포함되지 않았습니다.\n\nFirebase 콘솔 ➔ Authentication ➔ 설정 ➔ 승인된 도메인에 '${currentHost}'를 추가해 주세요!`);
    } else if (err.code === 'auth/popup-blocked') {
      alert('⚠️ 브라우저 팝업이 차단되었습니다. 주소창 우측에서 팝업 허용을 클릭해 주세요.');
    } else if (err.code !== 'auth/popup-closed-by-user') {
      console.error("Firebase 구글 로그인 오류:", err);
      alert(`구글 로그인 중 오류가 발생했습니다: ${err.message || err.code}`);
    }
    throw err;
  }
}

// Sign-Out
export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}

// Save Diary Entry to Firestore `diaries` collection
export async function saveDiaryToFirestore(entryData) {
  if (!isFirebaseReady || !db) {
    console.warn("⚠️ Firebase가 아직 준비되지 않아 저장할 수 없습니다.");
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, "diaries"), {
      ...entryData,
      createdTimestamp: serverTimestamp()
    });
    console.log("🔥 Firestore 클라우드 성공적으로 저장됨 (ID: " + docRef.id + ")");
    return docRef.id;
  } catch (err) {
    console.error("❌ Firestore 클라우드 저장 실패:", err);
    throw err;
  }
}

// Real-time listener for Class Diaries
export function subscribeToDiariesFirestore(callback) {
  if (!isFirebaseReady || !db) return;

  const q = collection(db, "diaries");

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ ...docSnap.data(), id: docSnap.id });
    });
    // Sort locally by date and time desc
    list.sort((a, b) => {
      const dateA = (a.date || '') + ' ' + (a.time || '');
      const dateB = (b.date || '') + ' ' + (b.time || '');
      return dateB.localeCompare(dateA);
    });
    console.log("🔥 Firestore 클라우드 실시간 일기 동기화 수신:", list.length, "건");
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

// Register Teacher & Auto Created Class in Firestore `teachers` collection
export async function registerTeacherAndClass(teacherData) {
  if (!isFirebaseReady || !db) return null;
  try {
    const docRef = await addDoc(collection(db, "teachers"), {
      ...teacherData,
      status: "approved", // 즉시 자동 승인
      createdTimestamp: serverTimestamp()
    });
    console.log("🔥 교사 및 학반 자동 등록 성공 ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("❌ 교사/학반 등록 오류:", err);
    throw err;
  }
}

// Fetch all registered teachers and classes for Super Admin (gusals0432@gmail.com)
export function subscribeToTeachersFirestore(callback) {
  if (!isFirebaseReady || !db) return;
  const q = collection(db, "teachers");
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ ...docSnap.data(), id: docSnap.id });
    });
    callback(list);
  }, (err) => {
    console.error("교사 목록 수신 오류:", err);
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
  deleteDiaryFromFirestore,
  registerTeacherAndClass,
  subscribeToTeachersFirestore,
  isReady: () => isFirebaseReady
};
