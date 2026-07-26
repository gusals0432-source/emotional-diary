/* ==========================================================================
   전국 아침 마음 일기장 MAIN JAVASCRIPT
   - 다학급(1~6학년, 1~10반) 자동 확장
   - 교사 구글 로그인 & 학반 자동 생성 (고유 학급 초대 코드 발급)
   - 실명 학생 로그인 & 학급 코드 검증
   - 최종 관리자(gusals0432@gmail.com) 가입 교사 및 학반 통합 관리 센터
   - 로그인 유지를 보장하는 스마트 되돌리기(goBack) 네비게이션
   ========================================================================== */

// --- Global Application State ---
const APP_STATE = {
  currentUser: null,           // { name, email, avatar, role, schoolName, grade, classNum, classCode, isTeacher, isSuperAdmin }
  selectedEmotion: null,       // 'joy', 'calm', 'anxious', 'sad', 'angry'
  selectedSubTags: [],
  selectedIntensity: 3,
  selectedCategories: [],
  selectedSticker: '⭐',
  isTeacherMode: false,
  isSuperAdmin: false,
  currentCalendarDate: new Date(),
  firestoreDiaries: null,
  registeredTeachers: [],
  navigationHistory: ['tab-write'],
  tempGoogleTeacherEmail: '',
  tempGoogleTeacherAvatar: ''
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
  "오늘 하루도 가장 빛나는 너를 응원해! 🌟",
  "어떤 마음이든 내 안의 귀중한 소리랍니다. 토닥토닥! 💖",
  "우리 반 친구들과 함께 따뜻한 웃음을 나눠보세요 😃",
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

    // Subscribe to Teachers Directory for Super Admin
    if (window.RaonFirebase.subscribeToTeachersFirestore) {
      window.RaonFirebase.subscribeToTeachersFirestore((teacherList) => {
        APP_STATE.registeredTeachers = teacherList || [];
        if (APP_STATE.isSuperAdmin) {
          renderSuperAdminPanel();
        }
      });
    }
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
    // Default fallback initial portal prompt
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
  if (APP_STATE.isSuperAdmin) renderSuperAdminPanel();
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
// 2. Multi-Class Navigation & Back Button System (Login Session Preserved)
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
  if (tabId === 'tab-super-admin') renderSuperAdminPanel();
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
// 3. User Session & Login UI Management
// ==========================================================================
function setLoggedInUser(userObj) {
  if (!userObj) return;

  // Check if Super Admin (gusals0432@gmail.com)
  const isSuperAdminEmail = userObj.email && userObj.email.toLowerCase().trim() === 'gusals0432@gmail.com';
  
  if (isSuperAdminEmail) {
    userObj.isSuperAdmin = true;
    userObj.isTeacher = true;
    userObj.role = 'super_admin';
    userObj.schoolName = userObj.schoolName || '새뜸초등학교';
    userObj.grade = userObj.grade || '6';
    userObj.classNum = userObj.classNum || '1';
    userObj.classCode = userObj.classCode || 'MASTER-ADMIN';
  }

  APP_STATE.currentUser = userObj;
  APP_STATE.isTeacherMode = !!(userObj.isTeacher || userObj.isSuperAdmin);
  APP_STATE.isSuperAdmin = !!isSuperAdminEmail;

  localStorage.setItem('raon_current_user', JSON.stringify(userObj));
  updateUserUI();

  if (window.confetti) {
    window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  }
}

function updateUserUI() {
  const btnPortalOpen = document.getElementById('btnPortalOpen');
  const userProfileBadge = document.getElementById('userProfileBadge');
  const userNameText = document.getElementById('userNameText');
  const userEmailText = document.getElementById('userEmailText');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const greetingStudentName = document.getElementById('greetingStudentName');
  const welcomeSubText = document.getElementById('welcomeSubText');

  const tabTeacherNav = document.getElementById('tabTeacherNav');
  const tabSuperAdminNav = document.getElementById('tabSuperAdminNav');

  const headerSchoolTitle = document.getElementById('headerSchoolTitle');
  const headerClassSubTitle = document.getElementById('headerClassSubTitle');
  const tabClassWeatherText = document.getElementById('tabClassWeatherText');

  if (APP_STATE.currentUser) {
    btnPortalOpen.classList.add('hidden');
    userProfileBadge.classList.remove('hidden');

    const roleTag = APP_STATE.isSuperAdmin ? '👑 최종관리자' : (APP_STATE.currentUser.isTeacher ? '👩‍🏫 담임교사' : '👨‍🎓 학생');
    const classInfoTag = APP_STATE.currentUser.classCode ? ` | ${APP_STATE.currentUser.schoolName || ''} ${APP_STATE.currentUser.grade || ''}-${APP_STATE.currentUser.classNum || ''} (코드:${APP_STATE.currentUser.classCode})` : '';

    userNameText.textContent = `${APP_STATE.currentUser.name} (${roleTag})`;
    userEmailText.textContent = (APP_STATE.currentUser.email || '') + classInfoTag;
    userAvatarImg.src = APP_STATE.currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(APP_STATE.currentUser.name)}`;

    if (greetingStudentName) greetingStudentName.textContent = APP_STATE.currentUser.name;
    if (welcomeSubText) welcomeSubText.textContent = `${APP_STATE.currentUser.schoolName || ''} ${APP_STATE.currentUser.grade || ''}학년 ${APP_STATE.currentUser.classNum || ''}반 교실의 아침 감정을 기록하세요.`;

    if (headerSchoolTitle) headerSchoolTitle.textContent = APP_STATE.currentUser.schoolName ? `${APP_STATE.currentUser.schoolName} ${APP_STATE.currentUser.grade}-${APP_STATE.currentUser.classNum}` : '전국 아침 마음 일기장';
    if (headerClassSubTitle) headerClassSubTitle.textContent = `코드: ${APP_STATE.currentUser.classCode || '통합'} · 아침 마음 일기장`;
    if (tabClassWeatherText) tabClassWeatherText.textContent = `${APP_STATE.currentUser.grade || ''}-${APP_STATE.currentUser.classNum || ''}반 마음 날씨`;

    // Show/Hide Teacher Dashboard & Super Admin Tabs based on role
    if (APP_STATE.isSuperAdmin) {
      if (tabTeacherNav) tabTeacherNav.classList.remove('hidden');
      if (tabSuperAdminNav) tabSuperAdminNav.classList.remove('hidden');
    } else if (APP_STATE.isTeacherMode) {
      if (tabTeacherNav) tabTeacherNav.classList.remove('hidden');
      if (tabSuperAdminNav) tabSuperAdminNav.classList.add('hidden');
    } else {
      if (tabTeacherNav) tabTeacherNav.classList.add('hidden');
      if (tabSuperAdminNav) tabSuperAdminNav.classList.add('hidden');
    }

    updateStreakCounter();
  } else {
    btnPortalOpen.classList.remove('hidden');
    userProfileBadge.classList.add('hidden');
    if (tabTeacherNav) tabTeacherNav.classList.add('hidden');
    if (tabSuperAdminNav) tabSuperAdminNav.classList.add('hidden');
    if (greetingStudentName) greetingStudentName.textContent = '학생';
  }
}

function handleLogout() {
  if (confirm('로그아웃 하시겠습니까? 세션이 해제되고 메인 포털 화면으로 이동합니다.')) {
    APP_STATE.currentUser = null;
    APP_STATE.isTeacherMode = false;
    APP_STATE.isSuperAdmin = false;
    localStorage.removeItem('raon_current_user');
    
    if (window.RaonFirebase && window.RaonFirebase.isReady()) {
      window.RaonFirebase.logoutFirebase().catch(e => console.warn(e));
    }

    updateUserUI();
    openLoginPortalModal();
  }
}

// ==========================================================================
// 4. Portal Modals & Role Sign-in Handling
// ==========================================================================
function openLoginPortalModal() {
  document.getElementById('loginPortalModal').classList.remove('hidden');
}

function closeLoginPortalModal() {
  document.getElementById('loginPortalModal').classList.add('hidden');
}

function openStudentLoginModal() {
  closeLoginPortalModal();
  document.getElementById('studentLoginModal').classList.remove('hidden');
}

function closeStudentLoginModal() {
  document.getElementById('studentLoginModal').classList.add('hidden');
}

function openTeacherSignupModal() {
  closeLoginPortalModal();
  document.getElementById('teacherSignupModal').classList.remove('hidden');
}

function closeTeacherSignupModal() {
  document.getElementById('teacherSignupModal').classList.add('hidden');
}

function openTeacherCodeWelcomeModal() {
  document.getElementById('teacherCodeWelcomeModal').classList.remove('hidden');
}

function closeTeacherCodeWelcomeModal() {
  document.getElementById('teacherCodeWelcomeModal').classList.add('hidden');
  switchTab('tab-teacher-dashboard');
}

// Helper function to generate unique Class Code (e.g. SAET-601-X82)
function generateClassCode(schoolName, grade, classNum) {
  let prefix = 'RAON';
  if (schoolName) {
    const clean = schoolName.replace(/초등학교|초/g, '').trim();
    prefix = clean.substring(0, 3).toUpperCase() || 'RAON';
  }
  const randSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${grade}0${classNum}-${randSuffix}`;
}

// Student Login Submission (Real Name & Class Code Verification)
function handleStudentLoginSubmit(e) {
  e.preventDefault();
  const schoolName = document.getElementById('studentSchoolInput').value.trim();
  const grade = document.getElementById('studentGradeSelect').value;
  const classNum = document.getElementById('studentClassSelect').value;
  const realName = document.getElementById('studentNameInput').value.trim();
  const classCode = document.getElementById('studentClassCodeInput').value.trim().toUpperCase();

  if (!schoolName || !realName || !classCode) {
    alert('학교명, 학생 실명, 그리고 선생님께 받은 학급 코드를 모두 입력해 주세요.');
    return;
  }

  if (realName.length < 2) {
    alert('⚠️ 닉네임 사용은 금지됩니다. 2글자 이상의 실명을 정확히 입력해 주세요.');
    return;
  }

  const userObj = {
    name: realName,
    email: `student_${Date.now()}@${classCode.toLowerCase()}.es.kr`,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(realName)}`,
    role: 'student',
    schoolName: schoolName,
    grade: grade,
    classNum: classNum,
    classCode: classCode,
    isGoogleAuth: false
  };

  setLoggedInUser(userObj);
  closeStudentLoginModal();
  alert(`👋 ${schoolName} ${grade}학년 ${classNum}반 ${realName} 학생님 환영합니다!`);
  switchTab('tab-write');
}

// Teacher Google Login Trigger for Signup
async function handleTeacherGoogleAuth() {
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    try {
      const user = await window.RaonFirebase.loginWithFirebaseGoogle();
      if (user) {
        APP_STATE.tempGoogleTeacherEmail = user.email || '';
        APP_STATE.tempGoogleTeacherAvatar = user.photoURL || '';
        document.getElementById('teacherNameInput').value = user.displayName || '';
        document.getElementById('teacherGoogleBtnText').textContent = `✅ 구글 인증 완료 (${user.email})`;
        alert(`구글 계정(${user.email}) 인증에 성공했습니다! 소속 학교 및 학반 정보를 입력 후 학반 생성을 완료해 주세요.`);
        return;
      }
    } catch (err) {
      console.warn("Teacher Google auth popup error:", err);
    }
  }
}

// Teacher Signup & Auto Class Code Generation Submission
function handleTeacherSignupSubmit(e) {
  e.preventDefault();
  const schoolName = document.getElementById('teacherSchoolInput').value.trim();
  const grade = document.getElementById('teacherGradeSelect').value;
  const classNum = document.getElementById('teacherClassSelect').value;
  const realName = document.getElementById('teacherNameInput').value.trim();

  if (!schoolName || !realName) {
    alert('학교명과 담임 교사 실명을 모두 입력해 주세요.');
    return;
  }

  const generatedCode = generateClassCode(schoolName, grade, classNum);
  const teacherEmail = APP_STATE.tempGoogleTeacherEmail || `teacher_${Date.now()}@${schoolName.toLowerCase()}.es.kr`;

  const teacherUser = {
    name: realName + ' 선생님',
    email: teacherEmail,
    avatar: APP_STATE.tempGoogleTeacherAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(realName)}`,
    role: 'teacher',
    isTeacher: true,
    schoolName: schoolName,
    grade: grade,
    classNum: classNum,
    classCode: generatedCode,
    status: 'approved' // 즉시 자동 승인
  };

  // Register Teacher & Class to Firestore
  if (window.RaonFirebase && window.RaonFirebase.isReady()) {
    window.RaonFirebase.registerTeacherAndClass(teacherUser).catch(err => console.warn(err));
  }

  setLoggedInUser(teacherUser);
  closeTeacherSignupModal();

  // Show Welcome Modal with generated Class Code
  document.getElementById('displayGeneratedClassCode').textContent = generatedCode;
  document.getElementById('teacherCodeWelcomeText').textContent = `${schoolName} ${grade}학년 ${classNum}반 (${realName} 선생님) 학반이 즉시 자동 승인 생성되었습니다. 아래 초대 코드를 학생들에게 공유하세요!`;
  openTeacherCodeWelcomeModal();
}

function copyGeneratedClassCode() {
  const code = document.getElementById('displayGeneratedClassCode').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => alert(`📋 학급 초대 코드 [ ${code} ]가 클립보드에 복사되었습니다!\n학생들에게 전달하여 학급 접속에 사용하게 해주세요.`));
  } else {
    alert(`📋 초대 코드: ${code}`);
  }
}

// ==========================================================================
// 5. Emotion Selection & Form Submission Logic
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
    alert('일기 작성을 위해 먼저 학생 또는 교사 계정으로 로그인해 주세요.');
    openLoginPortalModal();
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
    schoolName: APP_STATE.currentUser.schoolName || '새뜸초등학교',
    grade: APP_STATE.currentUser.grade || '6',
    classNum: APP_STATE.currentUser.classNum || '1',
    classCode: APP_STATE.currentUser.classCode || 'RAON-601',
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

// Helper to escape HTML text
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
// 6. Classroom Weather & Class Data Filtering
// ==========================================================================
function renderClassWeather() {
  const diaries = getStoredDiaries();
  const user = APP_STATE.currentUser;

  // Filter diaries for CURRENT CLASS ONLY
  const classDiaries = diaries.filter(d => {
    if (!d) return false;
    const isShared = (d.teacherOnly !== true && d.teacherOnly !== 'true');
    if (!isShared) return false;

    // Filter by Class Code or School-Grade-ClassNum
    if (user && user.classCode) {
      return d.classCode === user.classCode || (d.schoolName === user.schoolName && d.grade === user.grade && d.classNum === user.classNum);
    }
    return true; // Default show all if public demo
  });

  const counts = { joy: 0, calm: 0, anxious: 0, sad: 0, angry: 0 };
  classDiaries.forEach(d => {
    if (counts[d.emotion] !== undefined) counts[d.emotion]++;
  });

  const total = classDiaries.length || 1;

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

    if (classDiaries.length === 0) {
      feedGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 30px; color: #94a3b8;">아직 우리 반에 공유된 마음 일기가 없습니다. 첫 번째 일기를 공유해보세요! 🌟</div>`;
      return;
    }

    classDiaries.forEach(entry => {
      if (!entry) return;
      const userName = (entry.user && entry.user.name) || entry.userName || '학생';
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
// 7. Calendar & History View
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
    if (!d || !user) return true;
    return (d.user && d.user.email === user.email) || (d.user && d.user.name === user.name);
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
// 8. Teacher Dashboard Mode
// ==========================================================================
function renderTeacherFeed() {
  const grid = document.getElementById('teacherEntriesGrid');
  const banner = document.getElementById('teacherClassBanner');
  const titleEl = document.getElementById('teacherDashTitle');
  if (!grid) return;

  const user = APP_STATE.currentUser;

  if (banner && user) {
    banner.innerHTML = `
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 0.9rem; opacity: 0.9;">🏫 소속 담임 학학급 정보</div>
        <strong style="font-size: 1.4rem; font-family: 'Jua';">${user.schoolName || ''} ${user.grade || ''}학년 ${user.classNum || ''}반 (${user.name})</strong>
        <div style="margin-top: 6px; font-size: 0.9rem; background: rgba(255,255,255,0.2); display: inline-block; padding: 4px 12px; border-radius: 20px;">
          🔑 학급 초대 코드: <strong style="color: #fef08a;">${user.classCode || '통합'}</strong>
        </div>
      </div>
    `;
  }

  const filterEmotion = document.getElementById('teacherEmotionFilter') ? document.getElementById('teacherEmotionFilter').value : 'all';
  const diaries = getStoredDiaries();

  let filtered = diaries.filter(d => {
    if (!d) return false;
    if (APP_STATE.isSuperAdmin) return true; // Super admin sees all
    if (user && user.classCode) {
      return d.classCode === user.classCode || (d.schoolName === user.schoolName && d.grade === user.grade && d.classNum === user.classNum);
    }
    return true;
  });

  if (filterEmotion !== 'all') {
    filtered = filtered.filter(d => d.emotion === filterEmotion);
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">학급 학생 일기 내역이 없거나 조건에 해당하는 일기가 없습니다.</p>`;
    return;
  }

  filtered.forEach(entry => {
    if (!entry) return;
    const userName = (entry.user && entry.user.name) || entry.userName || '학생';
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
      <div style="font-size:0.8rem; color:#64748b;">${entry.date || ''} ${entry.time || ''} | 강도: ${entry.intensity || 3}단계 | 코드: ${entry.classCode || '-'}</div>
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

// ==========================================================================
// 9. Super Admin Master Control Center (gusals0432@gmail.com)
// ==========================================================================
function renderSuperAdminPanel() {
  if (!APP_STATE.isSuperAdmin) return;

  const tableBody = document.getElementById('superAdminTeacherTableBody');
  const statClassEl = document.getElementById('statSuperClassCount');
  const statTeacherEl = document.getElementById('statSuperTeacherCount');
  const statDiaryEl = document.getElementById('statSuperDiaryCount');

  const teachers = APP_STATE.registeredTeachers || [];
  const diaries = getStoredDiaries();

  // Calculate unique classes
  const classSet = new Set();
  teachers.forEach(t => {
    if (t.schoolName && t.grade && t.classNum) {
      classSet.add(`${t.schoolName}_${t.grade}_${t.classNum}`);
    }
  });

  if (statClassEl) statClassEl.textContent = `${classSet.size}개 학반`;
  if (statTeacherEl) statTeacherEl.textContent = `${teachers.length}명 교사`;
  if (statDiaryEl) statDiaryEl.textContent = `${diaries.length}건 일기`;

  if (tableBody) {
    tableBody.innerHTML = '';
    if (teachers.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#94a3b8;">가입된 담임 교사 내역이 없습니다. 교사 가입 시 여기에 자동으로 표시됩니다.</td></tr>`;
      return;
    }

    teachers.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(t.name || '교사')}</strong></td>
        <td>${escapeHtml(t.schoolName || '-')}</td>
        <td>${t.grade || '-'}학년 ${t.classNum || '-'}반</td>
        <td><span class="code-pill">${t.classCode || '-'}</span></td>
        <td>${escapeHtml(t.email || '-')}</td>
        <td><span style="color:#10b981; font-weight:bold;">● 즉시 자동 승인됨</span></td>
      `;
      tableBody.appendChild(tr);
    });
  }
}
