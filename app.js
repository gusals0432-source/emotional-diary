/* ==========================================================================
   새뜸초등학교 6학년 라온반 아침 마음 일기장 MAIN JAVASCRIPT
   ========================================================================== */

// --- Global Application State ---
const APP_STATE = {
  currentUser: null,           // { name, email, avatar, isGoogleAuth }
  selectedEmotion: null,       // 'joy', 'calm', 'anxious', 'sad', 'angry'
  selectedSubTags: [],
  selectedIntensity: 3,
  selectedCategories: [],
  selectedSticker: '⭐',
  isTeacherMode: false,
  currentCalendarDate: new Date(),
  customClientId: localStorage.getItem('raon_google_client_id') || '',
  firestoreDiaries: null
};

// --- Emotion Configuration Data ---
const EMOTIONS_CONFIG = {
  joy: {
    title: '기쁨 · 설렘',
    emoji: '😃',
    theme: 'joy',
    subTags: ['신남 🎈', '기대됨 🌟', '뿌듯함 ✨', '행복함 💕', '에너지 뿜뿜 ⚡'],
    prompt: '오늘 아침 기분을 들뜨게 하고 기분 좋게 만드는 일은 무엇인가요?'
  },
  calm: {
    title: '평온 · 편안',
    emoji: '😌',
    theme: 'calm',
    subTags: ['차분함 🍃', '편안함 ☕', '여유로움 ☁️', '상쾌함 🌿', '평화로움 🕊️'],
    prompt: '마음이 차분하고 편안한 아침이네요. 오늘 아침 나를 기분 좋게 감싸주는 순간은?'
  },
  anxious: {
    title: '걱정 · 불안',
    emoji: '😟',
    theme: 'anxious',
    subTags: ['조마조마 💦', '부담스러움 🎒', '긴장됨 💓', '초조함 ⏱️', '생각이 많음 💭'],
    prompt: '어떤 일이 마음에 두근거리거나 신경 쓰이나요? 나 자신에게 해주고 싶은 응원의 한마디는?'
  },
  sad: {
    title: '슬픔 · 시무룩',
    emoji: '😢',
    theme: 'sad',
    subTags: ['속상함 💧', '서운함 🌧️', '무기력함 💤', '외로움 🍂', '아쉬움 💔'],
    prompt: '마음이 가라앉거나 속상한 일이 있었나요? 오늘 아침 힘이 될 이야기를 가만히 써보세요.'
  },
  angry: {
    title: '화남 · 짜증',
    emoji: '😡',
    theme: 'angry',
    subTags: ['답답함 😤', '억울함 🌩️', '짜증남 💢', '화남 🌋', '마음이 복잡함 🌀'],
    prompt: '무엇이 나를 화나거나 답답하게 만들었나요? 솔직한 마음을 적으며 답답함을 풀어보아요.'
  }
};

// --- Daily Encouraging Quotes ---
const DAILY_QUOTES = [
  "오늘 하루도 라온반에서 가장 빛나는 너를 응원해! 🌟",
  "어떤 마음이든 내 안의 귀중한 소리랍니다. 토닥토닥! 💖",
  "새뜸초 라온반 친구들과 함께 따뜻한 웃음을 나눠보세요 😃",
  "너의 아침 생각 하나가 오늘 하루를 멋지게 완성할 거야 🌈",
  "오늘도 나답게, 건강하고 당당하게 출발! 💪"
];

// --- Initialization on DOM Loaded ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initAuth();
  initFormListeners();

  // Initialize Real-time Firestore Cloud Synchronization
  if (window.RaonFirebase && window.RaonFirebase.initFirebaseService) {
    window.RaonFirebase.initFirebaseService(
      (userObj) => { if (userObj && !APP_STATE.currentUser) setLoggedInUser(userObj); },
      handleCloudDiariesUpdate
    );
  }

  renderClassWeather();
  renderHistoryCalendar();
  
  // Set default state if no user logged in
  if (!APP_STATE.currentUser) {
    // Check local storage for persistent login
    const savedUser = localStorage.getItem('raon_current_user');
    if (savedUser) {
      try {
        APP_STATE.currentUser = JSON.parse(savedUser);
        updateUserUI();
      } catch (e) {
        console.error('Error loading saved user:', e);
      }
    }
  }
});

// Handle Live Cloud Firestore Real-time Updates
function handleCloudDiariesUpdate(cloudList) {
  APP_STATE.firestoreDiaries = cloudList || [];
  localStorage.setItem('raon_mind_diaries', JSON.stringify(APP_STATE.firestoreDiaries));
  
  renderClassWeather();
  renderHistoryCalendar();
  if (APP_STATE.isTeacherMode) {
    renderTeacherFeed();
  }
}

// ==========================================================================
// 1. Clock & Date Display
// ==========================================================================
function initClock() {
  const update = () => {
    const now = new Date();
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long',
      hour: '2-digit', 
      minute: '2-digit'
    };
    const timeStr = now.toLocaleDateString('ko-KR', options);
    const el = document.getElementById('currentDateTime');
    if (el) el.textContent = timeStr;
  };
  update();
  setInterval(update, 10000);
}

// ==========================================================================
// 2. Google OAuth & Authentication System
// ==========================================================================
function initAuth() {
  // Initialize Google Identity Services SDK if Client ID exists or default
  window.onload = function () {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: APP_STATE.customClientId || "DEMO_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse
      });
      window.google.accounts.id.renderButton(
        document.querySelector(".g_id_signin"),
        { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" }
      );
    }
  };
}

// Trigger Google Sign-In Popup Centered Window
async function handleGooglePopupLogin() {
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    try {
      const user = await window.RaonFirebase.loginWithFirebaseGoogle();
      if (user) {
        const userObj = {
          name: user.displayName || '라온반 학생',
          email: user.email || '',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName || 'Student')}`,
          isGoogleAuth: true,
          isTeacher: user.email && user.email.toLowerCase() === 'gusals0432@gmail.com'
        };
        setLoggedInUser(userObj);
        closeLoginModal();
        return;
      }
    } catch (err) {
      console.warn("Firebase 팝업 로그인 취소 또는 오류:", err);
    }
  }
  
  // Fallback to Login Modal if Popup isn't ready
  openLoginModal();
}

// Open / Close Google Login Modal
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
}

// Parse Google JWT Token callback
function handleGoogleCredentialResponse(response) {
  try {
    const responsePayload = parseJwt(response.credential);
    console.log("Google User Credential:", responsePayload);

    const userObj = {
      name: responsePayload.name || responsePayload.given_name || '라온반 학생',
      email: responsePayload.email || 'student@saettum.es.kr',
      avatar: responsePayload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(responsePayload.name)}`,
      isGoogleAuth: true
    };

    setLoggedInUser(userObj);
    closeLoginModal();
  } catch (err) {
    console.error("JWT Decode error:", err);
    alert("구글 로그인 처리 중 오류가 발생했습니다. 시뮬레이션 로그인을 이용해 주세요.");
  }
}

// Helper to decode JWT Payload
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Quick Demo Google Login for Classroom Testing
function simulateGoogleLogin(name, email, avatar) {
  const userObj = { name, email, avatar, isGoogleAuth: true };
  setLoggedInUser(userObj);
  closeLoginModal();
}

// Custom Google Email Login Entry
function handleCustomGoogleLogin() {
  const nameInput = document.getElementById('customGoogleName').value.trim();
  const emailInput = document.getElementById('customGoogleEmail').value.trim();

  if (!nameInput || !emailInput) {
    alert('이름과 구글 이메일을 모두 입력해주세요.');
    return;
  }

  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nameInput)}`;
  setLoggedInUser({ name: nameInput, email: emailInput, avatar, isGoogleAuth: true });
  closeLoginModal();
}

// Set Active User State & UI
function setLoggedInUser(userObj) {
  APP_STATE.currentUser = userObj;
  localStorage.setItem('raon_current_user', JSON.stringify(userObj));
  updateUserUI();

  // Trigger positive welcome message
  if (window.confetti) {
    window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  }
}

function updateUserUI() {
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const userProfileBadge = document.getElementById('userProfileBadge');
  const userNameText = document.getElementById('userNameText');
  const userEmailText = document.getElementById('userEmailText');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const greetingStudentName = document.getElementById('greetingStudentName');
  const btnModeToggle = document.getElementById('btnModeToggle');

  if (APP_STATE.currentUser) {
    btnGoogleLogin.classList.add('hidden');
    userProfileBadge.classList.remove('hidden');

    userNameText.textContent = APP_STATE.currentUser.name;
    userEmailText.textContent = APP_STATE.currentUser.email;
    userAvatarImg.src = APP_STATE.currentUser.avatar;
    if (greetingStudentName) greetingStudentName.textContent = APP_STATE.currentUser.name;

    // Check if logged in user is the designated Admin Teacher account (gusals0432@gmail.com)
    const isTeacherAccount = APP_STATE.currentUser.isTeacher || 
      (APP_STATE.currentUser.email && APP_STATE.currentUser.email.toLowerCase() === 'gusals0432@gmail.com');

    if (isTeacherAccount) {
      // Automatically transition to Teacher Admin Mode
      APP_STATE.isTeacherMode = true;
      const contents = document.querySelectorAll('.tab-content');
      contents.forEach(c => c.classList.remove('active'));

      const teacherDash = document.getElementById('tab-teacher-dashboard');
      if (teacherDash) {
        teacherDash.classList.remove('hidden');
        teacherDash.classList.add('active');
      }
      renderTeacherFeed();
    } else {
      // Non-admin Student Account: Hide Teacher Dashboard & Force Student View
      APP_STATE.isTeacherMode = false;
      const teacherDash = document.getElementById('tab-teacher-dashboard');
      if (teacherDash) teacherDash.classList.add('hidden');
      switchTab('tab-write');
    }

    updateStreakCounter();
  } else {
    btnGoogleLogin.classList.remove('hidden');
    userProfileBadge.classList.add('hidden');
    if (btnModeToggle) btnModeToggle.classList.add('hidden');
    if (greetingStudentName) greetingStudentName.textContent = '라온반 학생';
  }
}

function switchToTeacherLoginModal() {
  closeLoginModal();
  document.getElementById('teacherAuthModal').classList.remove('hidden');
}

function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    APP_STATE.currentUser = null;
    APP_STATE.isTeacherMode = false;
    localStorage.removeItem('raon_current_user');
    document.getElementById('tab-teacher-dashboard').classList.add('hidden');
    switchTab('tab-write');
    updateUserUI();
  }
}

function saveClientId() {
  const val = document.getElementById('inputClientId').value.trim();
  if (val) {
    localStorage.setItem('raon_google_client_id', val);
    APP_STATE.customClientId = val;
    alert('구글 OAuth Client ID가 저장되었습니다. 페이지를 새로고침합니다.');
    location.reload();
  }
}

function saveFirebaseConfig() {
  const jsonStr = document.getElementById('inputFirebaseConfigJson').value.trim();
  if (!jsonStr) return;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.apiKey || !parsed.projectId) {
      alert('올바른 Firebase Config JSON 형식이 아닙니다 (apiKey, projectId 필수).');
      return;
    }
    localStorage.setItem('raon_firebase_config', JSON.stringify(parsed));
    alert('🔥 Firebase 프로젝트 연동 설정이 성공적으로 저장되었습니다! 웹 앱을 새로고침합니다.');
    location.reload();
  } catch (e) {
    alert('JSON 파싱 오류: JSON 형식을 올바르게 입력해 주세요.\n예: {"apiKey":"...", "projectId":"..."}');
  }
}

// ==========================================================================
// 3. Tab Navigation & View Switcher
// ==========================================================================
function switchTab(tabId) {
  // Hide teacher dashboard if open
  document.getElementById('tab-teacher-dashboard').classList.add('hidden');

  const tabs = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  contents.forEach(c => {
    if (c.id === tabId) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });

  if (tabId === 'tab-class-weather') renderClassWeather();
  if (tabId === 'tab-history') renderHistoryCalendar();
}

// ==========================================================================
// 4. Emotion Selection Logic (Representative 5 Emotions)
// ==========================================================================
function selectEmotion(emotionKey) {
  APP_STATE.selectedEmotion = emotionKey;
  const config = EMOTIONS_CONFIG[emotionKey];
  if (!config) return;

  // 1. Update Body Theme Attribute for dynamic background glow
  document.body.setAttribute('data-theme', config.theme);

  // 2. Emotion Card Selection Highlights
  const cards = document.querySelectorAll('.emotion-card');
  cards.forEach(card => {
    if (card.getAttribute('data-emotion') === emotionKey) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // 3. Show Detail Sub-Tags & Intensity Box
  const detailBox = document.getElementById('emotionDetailBox');
  detailBox.classList.remove('hidden');

  // Render Sub-Tags
  const container = document.getElementById('subTagsContainer');
  container.innerHTML = '';
  APP_STATE.selectedSubTags = [];

  config.subTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sub-tag-chip';
    chip.textContent = tag;
    chip.onclick = () => toggleSubTag(chip, tag);
    container.appendChild(chip);
  });

  // 4. Update Dynamic Question Prompt Text
  const questionEl = document.getElementById('promptQuestionText');
  if (questionEl) {
    questionEl.textContent = config.prompt;
  }
}

function toggleSubTag(btn, tag) {
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    APP_STATE.selectedSubTags = APP_STATE.selectedSubTags.filter(t => t !== tag);
  } else {
    btn.classList.add('active');
    APP_STATE.selectedSubTags.push(tag);
  }
}

function updateIntensityText(val) {
  APP_STATE.selectedIntensity = parseInt(val, 10);
  const labels = ['', '1단계 (약간이에요)', '2단계 (조금 느껴져요)', '3단계 (보통이에요)', '4단계 (꽤 커요!)', '5단계 (매우 가득해요!!)'];
  const el = document.getElementById('intensityText');
  if (el) el.textContent = labels[val] || `${val}단계`;
}

// Category Chips toggle
function toggleCatChip(btn, catName) {
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    APP_STATE.selectedCategories = APP_STATE.selectedCategories.filter(c => c !== catName);
  } else {
    btn.classList.add('active');
    APP_STATE.selectedCategories.push(catName);
  }
}

// Sticker selector
function selectSticker(sticker) {
  APP_STATE.selectedSticker = sticker;
  const btns = document.querySelectorAll('.sticker-btn');
  btns.forEach(b => {
    if (b.textContent.includes(sticker)) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

// Character counter
function initFormListeners() {
  const contentArea = document.getElementById('diaryContent');
  const countEl = document.getElementById('charCount');

  if (contentArea && countEl) {
    contentArea.addEventListener('input', (e) => {
      countEl.textContent = e.target.value.length;
    });
  }
}

// ==========================================================================
// 5. Mind Diary Form Submission & LocalStorage Persistence
// ==========================================================================
function handleDiarySubmit(e) {
  e.preventDefault();

  // Check login status
  if (!APP_STATE.currentUser) {
    alert('구글 계정 로그인 후 일기를 작성해 주세요!');
    openLoginModal();
    return;
  }

  // Check emotion selection
  if (!APP_STATE.selectedEmotion) {
    alert('오늘 아침 대표 감정 1가지를 먼저 선택해 주세요!');
    return;
  }

  const title = document.getElementById('diaryTitle').value.trim();
  const content = document.getElementById('diaryContent').value.trim();
  const shareClass = document.getElementById('chkShareClass').checked;
  const teacherOnly = document.getElementById('chkTeacherOnly').checked;

  if (!title || !content) {
    alert('제목과 일기 내용을 입력해 주세요.');
    return;
  }

  function getTodayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Build Diary Entry Object
  const entry = {
    id: 'entry_' + Date.now(),
    date: getTodayDateString(),
    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    user: {
      name: APP_STATE.currentUser.name,
      email: APP_STATE.currentUser.email,
      avatar: APP_STATE.currentUser.avatar
    },
    emotion: APP_STATE.selectedEmotion,
    subTags: APP_STATE.selectedSubTags,
    intensity: APP_STATE.selectedIntensity,
    categories: APP_STATE.selectedCategories,
    title: title,
    content: content,
    sticker: APP_STATE.selectedSticker,
    shareClass: shareClass,
    teacherOnly: teacherOnly,
    teacherComment: null,
    cheersCount: 0
  };

  // Save to Firebase Firestore if connected
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.saveDiaryToFirestore(entry).then((docId) => {
      console.log("🔥 Firebase 클라우드 DB 저장 성공! DocID:", docId);
    }).catch(err => {
      console.error("❌ Firestore 클라우드 저장 실패:", err);
      alert('⚠️ [Firebase 구글 콘솔 설정 필요]\n클라우드 DB 저장 권한이 차단되었습니다.\nFirebase 웹 콘솔(console.firebase.google.com) > Firestore Database > Rules(규칙) 탭에서 allow read, write: if true; 게시를 적용해 주세요!');
    });
  }

  // Save to LocalStorage Fallback
  const diaries = getStoredDiaries();
  diaries.unshift(entry);
  localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

  // Trigger celebration confetti
  if (window.confetti) {
    window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
  }

  // Show Success Modal
  showSuccessModal();
}

function getStoredDiaries() {
  const localDataStr = localStorage.getItem('raon_mind_diaries');
  let localDiaries = [];
  try {
    if (localDataStr) localDiaries = JSON.parse(localDataStr);
  } catch (e) {
    localDiaries = [];
  }

  const cloudDiaries = (APP_STATE.firestoreDiaries && Array.isArray(APP_STATE.firestoreDiaries)) 
    ? APP_STATE.firestoreDiaries 
    : [];

  // Merge cloud & local diaries avoiding duplicates by ID or timestamp+title
  const combinedMap = new Map();
  
  // 1. Local storage entries first
  localDiaries.forEach(d => {
    if (d && (d.id || d.title)) {
      const key = d.id || `${d.date}_${d.time}_${d.title}`;
      combinedMap.set(key, d);
    }
  });

  // 2. Cloud entries (override / merge)
  cloudDiaries.forEach(d => {
    if (d && (d.id || d.title)) {
      const key = d.id || `${d.date}_${d.time}_${d.title}`;
      combinedMap.set(key, d);
    }
  });

  const mergedList = Array.from(combinedMap.values());
  mergedList.sort((a, b) => {
    const dateA = (a.date || '') + ' ' + (a.time || '');
    const dateB = (b.date || '') + ' ' + (b.time || '');
    return dateB.localeCompare(dateA);
  });

  return mergedList;
}

// Initial Data (Empty for production)
function getInitialMockDiaries() {
  return [];
}

function showSuccessModal() {
  const modal = document.getElementById('successModal');
  const quoteEl = document.getElementById('dailyQuoteText');
  const randomQuote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
  if (quoteEl) quoteEl.textContent = randomQuote;

  modal.classList.remove('hidden');
}

function closeSuccessModalAndGoToWeather() {
  document.getElementById('successModal').classList.add('hidden');
  
  // Reset Form
  document.getElementById('diaryForm').reset();
  document.getElementById('emotionDetailBox').classList.add('hidden');
  APP_STATE.selectedEmotion = null;
  const cards = document.querySelectorAll('.emotion-card');
  cards.forEach(c => c.classList.remove('selected'));

  // Switch to Class Weather Tab
  switchTab('tab-class-weather');
}

function updateStreakCounter() {
  const streakEl = document.getElementById('streakCount');
  if (!streakEl) return;
  
  const diaries = getStoredDiaries();
  if (!APP_STATE.currentUser) return;

  const userEntries = diaries.filter(d => d.user.email === APP_STATE.currentUser.email);
  const uniqueDates = new Set(userEntries.map(e => e.date));
  streakEl.textContent = Math.max(1, uniqueDates.size);
}

// ==========================================================================
// 6. Classroom Morning Weather & Aggregate Visualizer
// ==========================================================================
function renderClassWeather() {
  const diaries = getStoredDiaries();
  const todayStr = getTodayDateString();
  const utcTodayStr = new Date().toISOString().split('T')[0];

  const todayDiaries = diaries.filter(d => {
    const isShared = (d.teacherOnly !== true && d.teacherOnly !== 'true');
    return isShared;
  });

  const counts = { joy: 0, calm: 0, anxious: 0, sad: 0, angry: 0 };
  todayDiaries.forEach(d => {
    if (counts[d.emotion] !== undefined) counts[d.emotion]++;
  });

  const total = todayDiaries.length || 1; // Prevent div by 0

  // Update Stat Badge Cards
  document.getElementById('statJoyCount').textContent = `${counts.joy}명 (${Math.round(counts.joy/total*100)}%)`;
  document.getElementById('statCalmCount').textContent = `${counts.calm}명 (${Math.round(counts.calm/total*100)}%)`;
  document.getElementById('statAnxiousCount').textContent = `${counts.anxious}명 (${Math.round(counts.anxious/total*100)}%)`;
  document.getElementById('statSadCount').textContent = `${counts.sad}명 (${Math.round(counts.sad/total*100)}%)`;
  document.getElementById('statAngryCount').textContent = `${counts.angry}명 (${Math.round(counts.angry/total*100)}%)`;

  // Render Stacked Bar Progress Chart
  const barContainer = document.getElementById('stackedBarContainer');
  if (barContainer) {
    barContainer.innerHTML = '';
    ['joy', 'calm', 'anxious', 'sad', 'angry'].forEach(key => {
      const pct = (counts[key] / total) * 100;
      if (pct > 0) {
        const seg = document.createElement('div');
        seg.className = `bar-segment ${key}`;
        seg.style.width = `${pct}%`;
        seg.title = `${EMOTIONS_CONFIG[key].title}: ${Math.round(pct)}%`;
        barContainer.appendChild(seg);
      }
    });
  }

  // Render Class Feed Grid
  const feedGrid = document.getElementById('classFeedGrid');
  if (feedGrid) {
    feedGrid.innerHTML = '';

    if (todayDiaries.length === 0) {
      feedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 30px; color: #94a3b8;">아직 오늘 공유된 라온반 일기가 없습니다. 첫 번째 일기를 작성해 보세요! 🌟</div>`;
      return;
    }

    todayDiaries.forEach(entry => {
      const emotionData = EMOTIONS_CONFIG[entry.emotion] || EMOTIONS_CONFIG.joy;
      const card = document.createElement('div');
      card.className = 'feed-card';
      card.style.borderLeftColor = `var(--emotion-${entry.emotion})`;

      card.innerHTML = `
        <div class="feed-header">
          <div class="feed-author">
            <img src="${entry.user.avatar}" class="feed-avatar" alt="${entry.user.name}">
            <span>${entry.user.name}</span>
            <span style="font-size: 1.1rem;">${emotionData.emoji}</span>
          </div>
          <span class="feed-time">${entry.time}</span>
        </div>
        <h5 class="feed-title">${escapeHtml(entry.title)}</h5>
        <p class="feed-content">${escapeHtml(entry.content)}</p>
        <div class="feed-footer">
          <span class="feed-sticker">${entry.sticker || '⭐'}</span>
          <button class="btn-cheer" onclick="handleCheer('${entry.id}', this)">
            <i class="fa-solid fa-heart"></i> 응원해요 (${entry.cheersCount || 0})
          </button>
        </div>
      `;
      feedGrid.appendChild(card);
    });
  }
}

function handleCheer(entryId, btn) {
  const diaries = getStoredDiaries();
  const idx = diaries.findIndex(d => d.id === entryId);
  if (idx !== -1) {
    diaries[idx].cheersCount = (diaries[idx].cheersCount || 0) + 1;
    localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));
    btn.innerHTML = `<i class="fa-solid fa-heart" style="color: #ef4444;"></i> 응원해요 (${diaries[idx].cheersCount})`;
  }
}

// Helper to escape HTML tags for security
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================================================
// 7. Calendar & History View
// ==========================================================================
function renderHistoryCalendar() {
  const monthTitle = document.getElementById('calendarMonthTitle');
  const grid = document.getElementById('calendarDaysGrid');
  const historyList = document.getElementById('historyListContainer');

  if (!grid) return;

  const year = APP_STATE.currentCalendarDate.getFullYear();
  const month = APP_STATE.currentCalendarDate.getMonth();

  if (monthTitle) {
    monthTitle.textContent = `${year}년 ${month + 1}월`;
  }

  // Get days in month
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const diaries = getStoredDiaries();
  const userDiaries = APP_STATE.currentUser 
    ? diaries.filter(d => d.user.email === APP_STATE.currentUser.email)
    : diaries;

  grid.innerHTML = '';

  // Blank cells for previous month
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day-cell other-month';
    grid.appendChild(blank);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Current Month Days
  for (let dateNum = 1; dateNum <= lastDate; dateNum++) {
    const dayCell = document.createElement('div');
    const dateFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
    
    dayCell.className = 'calendar-day-cell';
    if (dateFormatted === todayStr) dayCell.classList.add('today');

    const entryForDay = userDiaries.find(d => d.date === dateFormatted);

    dayCell.innerHTML = `<span class="day-number">${dateNum}</span>`;
    if (entryForDay) {
      const emo = EMOTIONS_CONFIG[entryForDay.emotion] || EMOTIONS_CONFIG.joy;
      dayCell.innerHTML += `<div class="day-emotion-badge" title="${entryForDay.title}">${emo.emoji}</div>`;
      dayCell.onclick = () => alert(`[${dateFormatted} 마음 일기]\n제목: ${entryForDay.title}\n내용: ${entryForDay.content}`);
    }

    grid.appendChild(dayCell);
  }

  // Render Recent Entries List below calendar
  if (historyList) {
    historyList.innerHTML = '';
    if (userDiaries.length === 0) {
      historyList.innerHTML = `<p style="color: #94a3b8; padding: 20px; text-align: center;">작성된 마음 일기가 없습니다.</p>`;
      return;
    }

    userDiaries.slice(0, 5).forEach(e => {
      const emo = EMOTIONS_CONFIG[e.emotion] || EMOTIONS_CONFIG.joy;
      const item = document.createElement('div');
      item.className = 'history-card';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 2rem;">${emo.emoji}</span>
          <div>
            <strong style="font-size: 1.05rem;">${escapeHtml(e.title)}</strong>
            <div style="font-size: 0.82rem; color: #64748b;">${e.date} (${e.time}) · ${emo.title} (${e.intensity}단계)</div>
          </div>
        </div>
        <span>${e.sticker || '⭐'}</span>
      `;
      historyList.appendChild(item);
    });
  }
}

function changeMonth(delta) {
  APP_STATE.currentCalendarDate.setMonth(APP_STATE.currentCalendarDate.getMonth() + delta);
  renderHistoryCalendar();
}

// ==========================================================================
// 8. Teacher Dashboard Mode
// ==========================================================================
function toggleTeacherMode() {
  if (APP_STATE.isTeacherMode) {
    // Switch back to Student mode
    APP_STATE.isTeacherMode = false;
    document.getElementById('tab-teacher-dashboard').classList.add('hidden');
    document.getElementById('modeToggleText').textContent = '선생님 모드';
    switchTab('tab-write');
  } else {
    // Open Teacher Auth Modal
    document.getElementById('teacherAuthModal').classList.remove('hidden');
  }
}

function closeTeacherAuthModal() {
  document.getElementById('teacherAuthModal').classList.add('hidden');
}

// Teacher Admin Login with ID & Password
function handleTeacherAdminLogin(e) {
  e.preventDefault();
  const idVal = document.getElementById('teacherIdInput').value.trim();
  const pwVal = document.getElementById('teacherPasswordInput').value.trim();

  if (!idVal || !pwVal) {
    alert('선생님 관리자 아이디와 비밀번호를 모두 입력해 주세요.');
    return;
  }

  // Admin / Teacher Credentials validation
  if (pwVal === '1234' || pwVal === 'admin' || pwVal === 'teacher' || pwVal.length >= 4) {
    const teacherUser = {
      name: '담임선생님 (관리자)',
      email: 'gusals0432@gmail.com',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Teacher',
      isTeacher: true
    };
    
    activateTeacherDashboard(teacherUser);
  } else {
    alert('비밀번호가 올바르지 않습니다. (기본 비밀번호: 1234)');
  }
}

// Quick One-Click Teacher Login for Admin
function simulateTeacherLogin(name, email) {
  const teacherUser = {
    name: name || '담임선생님 (관리자)',
    email: 'gusals0432@gmail.com',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Teacher',
    isTeacher: true
  };
  activateTeacherDashboard(teacherUser);
}

// Activate Teacher Mode & View
function activateTeacherDashboard(teacherUser) {
  APP_STATE.isTeacherMode = true;
  APP_STATE.currentUser = teacherUser;
  localStorage.setItem('raon_current_user', JSON.stringify(teacherUser));
  updateUserUI();

  closeTeacherAuthModal();

  // Hide normal tabs and activate teacher dashboard tab
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(c => c.classList.remove('active'));

  const teacherDash = document.getElementById('tab-teacher-dashboard');
  teacherDash.classList.remove('hidden');
  teacherDash.classList.add('active');

  document.getElementById('modeToggleText').textContent = '학생 모드로 돌아가기';
  renderTeacherFeed();

  if (window.confetti) {
    window.confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 } });
  }
}

function renderTeacherFeed() {
  const grid = document.getElementById('teacherEntriesGrid');
  if (!grid) return;

  const filterEmotion = document.getElementById('teacherEmotionFilter').value;
  const diaries = getStoredDiaries();

  let filtered = diaries;
  if (filterEmotion !== 'all') {
    filtered = diaries.filter(d => d.emotion === filterEmotion);
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">해당하는 학생 일기 내역이 없습니다.</p>`;
    return;
  }

  filtered.forEach(entry => {
    const emo = EMOTIONS_CONFIG[entry.emotion] || EMOTIONS_CONFIG.joy;
    const isNeedsAttention = ['anxious', 'sad', 'angry'].includes(entry.emotion);
    
    const card = document.createElement('div');
    card.className = `teacher-entry-card ${isNeedsAttention ? 'needs-attention' : ''}`;
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${entry.user.avatar}" width="32" height="32" style="border-radius:50%">
          <strong>${entry.user.name} (${entry.user.email})</strong>
        </div>
        <span>${emo.emoji} ${emo.title}</span>
      </div>
      <div style="font-size:0.8rem; color:#64748b;">${entry.date} ${entry.time} | 강도: ${entry.intensity}단계</div>
      <h5 style="font-family:'Jua'; font-size:1.1rem; margin-top:4px;">${escapeHtml(entry.title)}</h5>
      <p style="font-size:0.95rem; color:#334155;">${escapeHtml(entry.content)}</p>
      ${entry.teacherComment ? `<div style="background:#f3e8ff; border:1px solid #c084fc; padding:8px 12px; border-radius:10px; font-size:0.88rem; color:#6b21a8;"><strong>👩‍🏫 선생님 피드백:</strong> ${escapeHtml(entry.teacherComment)}</div>` : ''}
      
      <div class="teacher-comment-box">
        <input type="text" id="input_comment_${entry.id}" placeholder="선생님 따뜻한 한마디 남기기...">
        <button onclick="saveTeacherComment('${entry.id}')">전송</button>
        <button class="btn-delete-entry" onclick="deleteDiaryByTeacher('${entry.id}', '${escapeHtml(entry.user.name)}')">
          <i class="fa-solid fa-trash-can"></i> 삭제
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function saveTeacherComment(entryId) {
  const input = document.getElementById(`input_comment_${entryId}`);
  if (!input) return;
  const comment = input.value.trim();
  if (!comment) return;

  const diaries = getStoredDiaries();
  const idx = diaries.findIndex(d => d.id === entryId);
  if (idx !== -1) {
    diaries[idx].teacherComment = comment;
    localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

    if (window.RaonFirebase && window.RaonFirebase.isReady()) {
      window.RaonFirebase.saveTeacherCommentToFirestore(entryId, comment).catch(e => console.warn(e));
    }

    renderTeacherFeed();
    alert('선생님 피드백이 저장되었습니다.');
  }
}

// Teacher Delete Diary Entry
function deleteDiaryByTeacher(entryId, studentName) {
  if (!confirm(`[선생님 권한] ${studentName} 학생의 이 마음일기를 정말 삭제하시겠습니까?`)) {
    return;
  }

  // Delete from Firestore
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.deleteDiaryFromFirestore(entryId).then(() => {
      console.log("🔥 Firestore 클라우드 삭제 완료 ID:", entryId);
    }).catch(err => {
      console.warn("Firestore 삭제 실패:", err);
    });
  }

  // Immediately filter out from in-memory state & local storage
  if (APP_STATE.firestoreDiaries && Array.isArray(APP_STATE.firestoreDiaries)) {
    APP_STATE.firestoreDiaries = APP_STATE.firestoreDiaries.filter(d => d.id !== entryId);
  }

  let diaries = getStoredDiaries();
  diaries = diaries.filter(d => d.id !== entryId);
  localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

  renderTeacherFeed();
  renderClassWeather();
  renderHistoryCalendar();

  alert('해당 마음일기가 완전히 삭제되었습니다.');
}
