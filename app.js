/* ==========================================================================
   새뜸초등학교 6학년 라온반 아침 마음 일기장 MAIN JAVASCRIPT
   - 새뜸초 6학년 라온반 전용 맞춤형 일기장
   - 관리자 계정 (gusals0432@gmail.com) 구글 로그인 시 담임 교사 모드 자동 이동
   - 실시간 클라우드 공유 & 학생 본인 작성 일기 삭제 지원
   - 로그인 유지를 보장하는 스마트 되돌리기(goBack) 네비게이션
   ========================================================================== */

// --- Global Application State ---
const APP_STATE = {
  currentUser: null,           // { name, email, avatar, isGoogleAuth, isTeacher }
  selectedEmotion: null,       // 'joy', 'calm', 'anxious', 'sad', 'angry'
  selectedSubTags: [],
  selectedIntensity: 3,
  selectedCategories: [],
  selectedSticker: '⭐',
  isTeacherMode: false,
  currentCalendarDate: new Date(),
  firestoreDiaries: null,
  navigationHistory: ['tab-write']
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
  initFormListeners();

  // Initialize Real-time Firestore Cloud Synchronization
  if (window.RaonFirebase && window.RaonFirebase.initFirebaseService) {
    window.RaonFirebase.initFirebaseService(
      (userObj) => { if (userObj && !APP_STATE.currentUser) setLoggedInUser(userObj); },
      handleCloudDiariesUpdate
    );
  }

  // Restore Saved Session from LocalStorage
  const savedUser = localStorage.getItem('raon_current_user');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      setLoggedInUser(parsed);
    } catch (e) {
      console.error('Error loading saved user:', e);
    }
  } else {
    updateUserUI();
  }

  renderClassWeather();
  renderHistoryCalendar();
});

// Handle Live Cloud Firestore Real-time Updates
function handleCloudDiariesUpdate(cloudList) {
  if (Array.isArray(cloudList)) {
    APP_STATE.firestoreDiaries = cloudList;
    localStorage.setItem('raon_mind_diaries', JSON.stringify(cloudList));
  }

  renderClassWeather();
  renderHistoryCalendar();
  if (APP_STATE.isTeacherMode) renderTeacherFeed();
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
// 2. Navigation & Smart Back Button System (Login Session Preserved)
// ==========================================================================
function switchTab(tabId, pushHistory = true) {
  if (pushHistory) {
    const lastTab = APP_STATE.navigationHistory[APP_STATE.navigationHistory.length - 1];
    if (lastTab !== tabId) {
      APP_STATE.navigationHistory.push(tabId);
    }
  }

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(c => {
    if (c.id === tabId) {
      c.classList.remove('hidden');
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });

  if (tabId === 'tab-class-weather') renderClassWeather();
  if (tabId === 'tab-history') renderHistoryCalendar();
  if (tabId === 'tab-teacher-dashboard') renderTeacherFeed();
}

// Smart Back Navigation (Preserves User Login Session Always!)
function goBack() {
  if (APP_STATE.navigationHistory.length > 1) {
    APP_STATE.navigationHistory.pop(); // Remove current view
    const previousTab = APP_STATE.navigationHistory[APP_STATE.navigationHistory.length - 1];
    switchTab(previousTab, false);
  } else {
    // If stack is at top, always go back to main first page ('tab-write')
    switchTab('tab-write', false);
  }
}

// ==========================================================================
// 3. Google OAuth & User Session Management
// ==========================================================================
async function handleGooglePopupLogin() {
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    try {
      const user = await window.RaonFirebase.loginWithFirebaseGoogle();
      if (user) {
        const isTeacherAccount = user.email && user.email.toLowerCase().trim() === 'gusals0432@gmail.com';
        const userObj = {
          name: isTeacherAccount ? '권현민 선생님' : (user.displayName || '라온반 학생'),
          email: user.email || '',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName || 'Student')}`,
          isGoogleAuth: true,
          isTeacher: isTeacherAccount
        };
        setLoggedInUser(userObj);
        closeLoginModal();
        return;
      }
    } catch (err) {
      console.warn("Firebase 팝업 로그인 취소 또는 오류:", err);
    }
  }
  openLoginModal();
}

function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
}

function setLoggedInUser(userObj) {
  if (!userObj) return;

  const isTeacherAccount = userObj.email && userObj.email.toLowerCase().trim() === 'gusals0432@gmail.com';
  userObj.isTeacher = isTeacherAccount;

  APP_STATE.currentUser = userObj;
  APP_STATE.isTeacherMode = isTeacherAccount;

  localStorage.setItem('raon_current_user', JSON.stringify(userObj));
  updateUserUI();

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
  const tabTeacherNav = document.getElementById('tabTeacherNav');

  if (APP_STATE.currentUser) {
    btnGoogleLogin.classList.add('hidden');
    userProfileBadge.classList.remove('hidden');

    userNameText.textContent = APP_STATE.currentUser.name;
    userEmailText.textContent = APP_STATE.currentUser.email;
    userAvatarImg.src = APP_STATE.currentUser.avatar;

    if (greetingStudentName) greetingStudentName.textContent = APP_STATE.currentUser.name;

    const isTeacherAccount = APP_STATE.currentUser.isTeacher || 
      (APP_STATE.currentUser.email && APP_STATE.currentUser.email.toLowerCase().trim() === 'gusals0432@gmail.com');

    if (isTeacherAccount) {
      APP_STATE.isTeacherMode = true;
      if (tabTeacherNav) tabTeacherNav.classList.remove('hidden');
      switchTab('tab-teacher-dashboard');
    } else {
      APP_STATE.isTeacherMode = false;
      if (tabTeacherNav) tabTeacherNav.classList.add('hidden');
    }

    updateStreakCounter();
  } else {
    btnGoogleLogin.classList.remove('hidden');
    userProfileBadge.classList.add('hidden');
    if (tabTeacherNav) tabTeacherNav.classList.add('hidden');
    if (greetingStudentName) greetingStudentName.textContent = '라온반 학생';
  }
}

function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    APP_STATE.currentUser = null;
    APP_STATE.isTeacherMode = false;
    localStorage.removeItem('raon_current_user');

    if (window.RaonFirebase && window.RaonFirebase.isReady()) {
      window.RaonFirebase.logoutFirebase().catch(e => console.warn(e));
    }

    updateUserUI();
    switchTab('tab-write');
  }
}

// ==========================================================================
// 4. Emotion Selection & Form Submission Logic
// ==========================================================================
function selectEmotion(emotionKey) {
  APP_STATE.selectedEmotion = emotionKey;
  const config = EMOTIONS_CONFIG[emotionKey];
  if (!config) return;

  document.body.setAttribute('data-theme', config.theme);

  const cards = document.querySelectorAll('.emotion-card');
  cards.forEach(card => {
    if (card.getAttribute('data-emotion') === emotionKey) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const detailBox = document.getElementById('emotionDetailBox');
  detailBox.classList.remove('hidden');

  renderSubTags(config.subTags);

  const promptEl = document.getElementById('emotionPromptText');
  if (promptEl) promptEl.textContent = config.prompt;

  detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSubTags(tagsList) {
  const container = document.getElementById('subTagsContainer');
  if (!container) return;
  container.innerHTML = '';
  APP_STATE.selectedSubTags = [];

  tagsList.forEach(tagText => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sub-tag-chip';
    chip.textContent = tagText;
    chip.onclick = () => {
      chip.classList.toggle('selected');
      chip.classList.toggle('active');
      if (chip.classList.contains('selected')) {
        APP_STATE.selectedSubTags.push(tagText);
      } else {
        APP_STATE.selectedSubTags = APP_STATE.selectedSubTags.filter(t => t !== tagText);
      }
    };
    container.appendChild(chip);
  });
}

function updateIntensity(val) {
  APP_STATE.selectedIntensity = parseInt(val, 10);
  const labels = ['1단계 (살짝 느껴져요)', '2단계 (조금 느껴져요)', '3단계 (적당히 느껴져요)', '4단계 (꽤 강하게 느껴져요)', '5단계 (아주 가득 차 있어요!)'];
  const textEl = document.getElementById('intensityLabelText');
  if (textEl) textEl.textContent = labels[val - 1] || `${val}단계`;
}

function toggleCatChip(btn, categoryName) {
  btn.classList.toggle('selected');
  btn.classList.toggle('active');
  if (btn.classList.contains('selected')) {
    if (!APP_STATE.selectedCategories.includes(categoryName)) {
      APP_STATE.selectedCategories.push(categoryName);
    }
  } else {
    APP_STATE.selectedCategories = APP_STATE.selectedCategories.filter(c => c !== categoryName);
  }
}

function selectSticker(stickerChar) {
  APP_STATE.selectedSticker = stickerChar;
  const btns = document.querySelectorAll('.sticker-btn');
  btns.forEach(b => {
    if (b.textContent.includes(stickerChar)) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function initFormListeners() {
  const contentArea = document.getElementById('diaryContent');
  const countEl = document.getElementById('charCount');
  if (contentArea && countEl) {
    contentArea.addEventListener('input', () => {
      countEl.textContent = contentArea.value.length;
    });
  }
}

// Diary Submission Handler
function handleDiarySubmit(e) {
  e.preventDefault();

  if (!APP_STATE.currentUser) {
    alert('마음일기 작성을 위해 먼저 구글 계정으로 로그인해 주세요.');
    handleGooglePopupLogin();
    return;
  }

  if (!APP_STATE.selectedEmotion) {
    alert('상단의 5가지 대표 감정 중 하나를 선택해 주세요!');
    return;
  }

  const title = document.getElementById('diaryTitle').value.trim();
  const content = document.getElementById('diaryContent').value.trim();
  const shareClass = document.getElementById('chkShareClass').checked;
  const teacherOnly = document.getElementById('chkTeacherOnly').checked;

  if (!title || !content) {
    alert('일기 제목과 솔직한 이야기를 모두 작성해 주세요.');
    return;
  }

  const now = new Date();
  const todayStr = getTodayDateString();
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const entry = {
    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    date: todayStr,
    time: timeStr,
    user: {
      name: APP_STATE.currentUser.name,
      email: APP_STATE.currentUser.email,
      avatar: APP_STATE.currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(APP_STATE.currentUser.name)}`
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
    cheersCount: 0,
    createdTimestamp: now.toISOString()
  };

  // Save to LocalStorage
  const diaries = getStoredDiaries();
  diaries.unshift(entry);
  localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

  // Save to Firestore Cloud
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.saveDiaryToFirestore(entry).catch(err => {
      console.warn("Firestore 저장 예외:", err);
    });
  }

  // Reset Form
  document.getElementById('diaryForm').reset();
  APP_STATE.selectedEmotion = null;
  document.getElementById('emotionDetailBox').classList.add('hidden');

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

  const combinedMap = new Map();
  localDiaries.forEach(d => {
    if (d && (d.id || d.title)) {
      const key = d.id || `${d.date}_${d.time}_${d.title}`;
      combinedMap.set(key, d);
    }
  });

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

function showSuccessModal() {
  const modal = document.getElementById('successModal');
  const quoteEl = document.getElementById('dailyQuoteText');
  const randQuote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
  if (quoteEl) quoteEl.textContent = `"${randQuote}"`;

  modal.classList.remove('hidden');

  if (window.confetti) {
    window.confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
  }
}

function closeSuccessModalAndGoToWeather() {
  document.getElementById('successModal').classList.add('hidden');
  switchTab('tab-class-weather');
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// 5. Classroom Morning Weather Visualizer
// ==========================================================================
function renderClassWeather() {
  const diaries = getStoredDiaries();

  const todayDiaries = diaries.filter(d => {
    if (!d) return false;
    const isShared = (d.teacherOnly !== true && d.teacherOnly !== 'true');
    return isShared;
  });

  const counts = { joy: 0, calm: 0, anxious: 0, sad: 0, angry: 0 };
  todayDiaries.forEach(d => {
    if (counts[d.emotion] !== undefined) counts[d.emotion]++;
  });

  const total = todayDiaries.length || 1;

  // Update Stat Cards
  document.getElementById('statJoyCount').textContent = `${counts.joy}명 (${Math.round(counts.joy/total*100)}%)`;
  document.getElementById('statCalmCount').textContent = `${counts.calm}명 (${Math.round(counts.calm/total*100)}%)`;
  document.getElementById('statAnxiousCount').textContent = `${counts.anxious}명 (${Math.round(counts.anxious/total*100)}%)`;
  document.getElementById('statSadCount').textContent = `${counts.sad}명 (${Math.round(counts.sad/total*100)}%)`;
  document.getElementById('statAngryCount').textContent = `${counts.angry}명 (${Math.round(counts.angry/total*100)}%)`;

  // Render Bar Chart
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
      if (!entry) return;
      const userName = (entry.user && entry.user.name) || entry.userName || '라온반 학생';
      const userAvatar = (entry.user && entry.user.avatar) || entry.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`;
      const emotionData = EMOTIONS_CONFIG[entry.emotion] || EMOTIONS_CONFIG.joy;

      const card = document.createElement('div');
      card.className = 'feed-card';
      card.style.borderLeftColor = `var(--emotion-${entry.emotion || 'joy'})`;

      card.innerHTML = `
        <div class="feed-header">
          <div class="feed-author">
            <img src="${userAvatar}" class="feed-avatar" alt="${userName}">
            <span>${userName}</span>
            <span style="font-size: 1.1rem;">${emotionData.emoji}</span>
          </div>
          <span class="feed-time">${entry.time || '방금 전'}</span>
        </div>
        <h5 class="feed-title">${escapeHtml(entry.title || '')}</h5>
        <p class="feed-content">${escapeHtml(entry.content || '')}</p>
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

    if (window.RaonFirebase && window.RaonFirebase.isReady()) {
      window.RaonFirebase.addCheerToFirestore(entryId).catch(e => console.warn(e));
    }
  }
}

// ==========================================================================
// 6. Calendar & History View
// ==========================================================================
function renderHistoryCalendar() {
  const monthTitle = document.getElementById('calendarMonthTitle');
  const grid = document.getElementById('calendarDaysGrid');
  const historyList = document.getElementById('historyListContainer');
  if (!grid) return;

  const year = APP_STATE.currentCalendarDate.getFullYear();
  const month = APP_STATE.currentCalendarDate.getMonth();

  if (monthTitle) monthTitle.textContent = `${year}년 ${month + 1}월`;

  grid.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    grid.appendChild(emptyCell);
  }

  const diaries = getStoredDiaries();
  const user = APP_STATE.currentUser;

  const userDiaries = diaries.filter(d => {
    if (!d || !user) return false;
    const emailMatch = (user.email && d.user && d.user.email) ? (d.user.email === user.email) : false;
    const nameMatch = (user.name && d.user && d.user.name) ? (d.user.name === user.name) : false;
    return emailMatch || nameMatch;
  });

  const todayStr = getTodayDateString();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    const dayFormatted = String(day).padStart(2, '0');
    const monthFormatted = String(month + 1).padStart(2, '0');
    const dateFormatted = `${year}-${monthFormatted}-${dayFormatted}`;

    if (dateFormatted === todayStr) {
      dayCell.classList.add('today');
    }

    dayCell.innerHTML = `<span class="day-number">${day}</span>`;

    const entryForDay = userDiaries.find(d => d.date === dateFormatted);
    if (entryForDay) {
      const emo = EMOTIONS_CONFIG[entryForDay.emotion] || EMOTIONS_CONFIG.joy;
      dayCell.innerHTML += `<div class="day-emotion-badge" title="${entryForDay.title}">${emo.emoji}</div>`;
      dayCell.onclick = () => alert(`[${dateFormatted} 마음 일기]\n제목: ${entryForDay.title}\n내용: ${entryForDay.content}`);
    }

    grid.appendChild(dayCell);
  }

  if (historyList) {
    historyList.innerHTML = '';
    if (userDiaries.length === 0) {
      historyList.innerHTML = `<p style="color: #94a3b8; padding: 20px; text-align: center;">작성된 마음 일기가 없습니다.</p>`;
      return;
    }

    userDiaries.forEach(e => {
      if (!e) return;
      const emo = EMOTIONS_CONFIG[e.emotion] || EMOTIONS_CONFIG.joy;
      const item = document.createElement('div');
      item.className = 'history-card';
      item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 14px; background: #ffffff; border-radius: 14px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);";
      
      const isMyEntry = APP_STATE.currentUser && e.user && (e.user.email === APP_STATE.currentUser.email || e.user.name === APP_STATE.currentUser.name);

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 2rem;">${emo.emoji}</span>
          <div>
            <strong style="font-size: 1.05rem;">${escapeHtml(e.title || '')}</strong>
            <div style="font-size: 0.82rem; color: #64748b;">${e.date || ''} (${e.time || ''}) · ${emo.title} (${e.intensity || 3}단계)</div>
            <p style="font-size: 0.9rem; color: #334155; margin-top: 4px;">${escapeHtml(e.content || '')}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">${e.sticker || '⭐'}</span>
          ${isMyEntry ? `
            <button class="btn-delete-entry" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deleteDiaryByUser('${e.id}', '${escapeHtml(e.title || '')}')">
              <i class="fa-solid fa-trash-can"></i> 삭제
            </button>
          ` : ''}
        </div>
      `;
      historyList.appendChild(item);
    });
  }
}

function deleteDiaryByUser(entryId, title) {
  if (!confirm(`[본인 확인] 내가 작성한 마음일기 "${title}"을(를) 정말 삭제하시겠습니까?`)) {
    return;
  }

  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.deleteDiaryFromFirestore(entryId).catch(err => console.warn(err));
  }

  if (APP_STATE.firestoreDiaries && Array.isArray(APP_STATE.firestoreDiaries)) {
    APP_STATE.firestoreDiaries = APP_STATE.firestoreDiaries.filter(d => d.id !== entryId);
  }

  let diaries = getStoredDiaries();
  diaries = diaries.filter(d => d.id !== entryId);
  localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

  renderHistoryCalendar();
  renderClassWeather();
  if (APP_STATE.isTeacherMode) renderTeacherFeed();

  alert('내가 작성한 마음일기가 삭제되었습니다.');
}

function changeMonth(delta) {
  APP_STATE.currentCalendarDate.setMonth(APP_STATE.currentCalendarDate.getMonth() + delta);
  renderHistoryCalendar();
}

function updateStreakCounter() {
  const countEl = document.getElementById('streakCount');
  if (countEl) countEl.textContent = '1';
}

// ==========================================================================
// 7. Teacher Dashboard Mode (gusals0432@gmail.com)
// ==========================================================================
function renderTeacherFeed() {
  const grid = document.getElementById('teacherEntriesGrid');
  if (!grid) return;

  const filterEmotion = document.getElementById('teacherEmotionFilter') ? document.getElementById('teacherEmotionFilter').value : 'all';
  const diaries = getStoredDiaries();

  let filtered = diaries;
  if (filterEmotion !== 'all') {
    filtered = diaries.filter(d => d.emotion === filterEmotion);
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">해당하는 라온반 학생 일기 내역이 없습니다.</p>`;
    return;
  }

  filtered.forEach(entry => {
    if (!entry) return;
    const userName = (entry.user && entry.user.name) || entry.userName || '라온반 학생';
    const userEmail = (entry.user && entry.user.email) || entry.userEmail || '';
    const userAvatar = (entry.user && entry.user.avatar) || entry.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`;
    const emo = EMOTIONS_CONFIG[entry.emotion] || EMOTIONS_CONFIG.joy;
    const isNeedsAttention = ['anxious', 'sad', 'angry'].includes(entry.emotion);
    
    const card = document.createElement('div');
    card.className = `teacher-entry-card ${isNeedsAttention ? 'needs-attention' : ''}`;
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${userAvatar}" width="32" height="32" style="border-radius:50%">
          <strong>${userName} (${userEmail})</strong>
        </div>
        <span>${emo.emoji} ${emo.title}</span>
      </div>
      <div style="font-size:0.8rem; color:#64748b;">${entry.date || ''} ${entry.time || ''} | 강도: ${entry.intensity || 3}단계</div>
      <h5 style="font-family:'Jua'; font-size:1.1rem; margin-top:4px;">${escapeHtml(entry.title || '')}</h5>
      <p style="font-size:0.95rem; color:#334155;">${escapeHtml(entry.content || '')}</p>
      ${entry.teacherComment ? `<div style="background:#f3e8ff; border:1px solid #c084fc; padding:8px 12px; border-radius:10px; font-size:0.88rem; color:#6b21a8;"><strong>👩‍🏫 선생님 피드백:</strong> ${escapeHtml(entry.teacherComment)}</div>` : ''}
      
      <div class="teacher-comment-box">
        <input type="text" id="input_comment_${entry.id}" placeholder="선생님 따뜻한 한마디 남기기...">
        <button onclick="saveTeacherComment('${entry.id}')">전송</button>
        <button class="btn-delete-entry" onclick="deleteDiaryByTeacher('${entry.id}', '${escapeHtml(userName)}')">
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

function deleteDiaryByTeacher(entryId, studentName) {
  if (!confirm(`[선생님 권한] ${studentName} 학생의 이 마음일기를 정말 삭제하시겠습니까?`)) {
    return;
  }

  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.deleteDiaryFromFirestore(entryId).catch(err => console.warn(err));
  }

  if (APP_STATE.firestoreDiaries && Array.isArray(APP_STATE.firestoreDiaries)) {
    APP_STATE.firestoreDiaries = APP_STATE.firestoreDiaries.filter(d => d.id !== entryId);
  }

  let diaries = getStoredDiaries();
  diaries = diaries.filter(d => d.id !== entryId);
  localStorage.setItem('raon_mind_diaries', JSON.stringify(diaries));

  renderTeacherFeed();
  renderClassWeather();
  renderHistoryCalendar();

  alert('해당 마음일기가 삭제되었습니다.');
}
