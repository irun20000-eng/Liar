// ===== 라이어 게임 (한 기기 돌려쓰기) =====
"use strict";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TIMER = 180; // 3분
const STORE_SETTINGS = "liar.settings.v1";
const STORE_SCORE = "liar.score.v1";
const STORE_CUSTOM = "liar.custom.v1";

// ----- 설정 상태 -----
const settings = {
  playerCount: 5,
  liarCount: 1,
  categories: [], // 선택된 카테고리 이름들
  spyMode: false,
  comeback: true,
  timer: false,
  easy: true, // 쉬움 모드: 라이어에게 카테고리 힌트 제공
  playerNames: ["아빠", "엄마", "예예", "두지", "토리"], // 기본 닉네임
  theme: "rose", // 색 테마
  sound: true, // 효과음 + 진동
  seenCats: [], // 사용자가 이미 본 기본 카테고리 (새 팩 자동 활성화용)
};

// 선택 가능한 테마 (가족별 색상 + 다크모드)
const THEMES = [
  { id: "candy", name: "캔디", color: "#ff8fb1" },   // 초기 귀염폭발 버전
  { id: "rose", name: "로즈", color: "#e15b7a" },    // 세련 기본
  { id: "navy", name: "네이비", color: "#2f4a73" },
  { id: "beige", name: "베이지", color: "#b9745f" },
  { id: "mono", name: "모노", color: "#1c1c1f" },
  { id: "mood", name: "무드", color: "#5a7184" },
  { id: "pastel", name: "파스텔", color: "#a87fe0" },
  { id: "dark", name: "다크", color: "#2a2a32" },
];

// ----- 누적 점수판 -----
const score = { citizens: 0, liars: 0, round: 0 };

// ----- 사용자 추가 단어 -----
// { 카테고리이름: [ { word, spy }, ... ] }
let customWords = {};
let editingRef = null; // 편집 중인 항목 { cat, index }

// ----- 진행 중 게임 상태 -----
let game = null;
let timerId = null;
let lastWord = null; // 같은 단어 연속 출제 방지용

// 기본 단어 + 사용자 단어를 합친 실제 사용 은행
function getBank() {
  const bank = {};
  for (const k of Object.keys(WORD_BANK)) bank[k] = WORD_BANK[k].slice();
  for (const k of Object.keys(customWords)) {
    if (!bank[k]) bank[k] = [];
    bank[k] = bank[k].concat(customWords[k]);
  }
  return bank;
}

// ===================================================================
//  저장/불러오기 (localStorage)
// ===================================================================
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_SETTINGS);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    // 저장된 값 중 유효한 항목만 반영
    if (typeof saved.playerCount === "number")
      settings.playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, saved.playerCount));
    if (typeof saved.liarCount === "number") settings.liarCount = saved.liarCount;
    if (Array.isArray(saved.categories)) settings.categories = saved.categories;
    if (typeof saved.spyMode === "boolean") settings.spyMode = saved.spyMode;
    if (typeof saved.comeback === "boolean") settings.comeback = saved.comeback;
    if (typeof saved.timer === "boolean") settings.timer = saved.timer;
    if (typeof saved.easy === "boolean") settings.easy = saved.easy;
    if (Array.isArray(saved.playerNames))
      settings.playerNames = saved.playerNames.map((n) => (typeof n === "string" ? n : "")).slice(0, MAX_PLAYERS);
    if (typeof saved.theme === "string" && THEMES.some((t) => t.id === saved.theme))
      settings.theme = saved.theme;
    if (typeof saved.sound === "boolean") settings.sound = saved.sound;
    if (Array.isArray(saved.seenCats)) settings.seenCats = saved.seenCats.filter((c) => typeof c === "string");
    // 더 이상 존재하지 않는 카테고리는 걸러내기
    const valid = new Set(Object.keys(WORD_BANK));
    settings.categories = settings.categories.filter((c) => valid.has(c));
    settings.liarCount = Math.min(Math.max(1, settings.liarCount), settings.playerCount - 1);
    return true;
  } catch (e) {
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORE_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    /* 저장 불가(시크릿 모드 등)여도 게임은 계속 동작 */
  }
}

function loadScore() {
  try {
    const raw = localStorage.getItem(STORE_SCORE);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.citizens === "number") score.citizens = s.citizens;
    if (typeof s.liars === "number") score.liars = s.liars;
    if (typeof s.round === "number") score.round = s.round;
  } catch (e) {
    /* 무시 */
  }
}

function saveScore() {
  try {
    localStorage.setItem(STORE_SCORE, JSON.stringify(score));
  } catch (e) {
    /* 무시 */
  }
}

// 외부/저장 데이터 정제: { 카테고리: [{word, spy}] } 형태만 남김
function sanitizeCustom(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const cat of Object.keys(obj)) {
    if (typeof cat !== "string" || !cat.trim() || !Array.isArray(obj[cat])) continue;
    const items = obj[cat]
      .filter((e) => e && typeof e.word === "string" && e.word.trim())
      .map((e) => ({ word: e.word.trim(), spy: (typeof e.spy === "string" ? e.spy : "").trim() }));
    if (items.length) out[cat] = items;
  }
  return out;
}

function loadCustom() {
  try {
    const raw = localStorage.getItem(STORE_CUSTOM);
    if (!raw) return;
    customWords = sanitizeCustom(JSON.parse(raw));
  } catch (e) {
    /* 무시 */
  }
}

function saveCustom() {
  try {
    localStorage.setItem(STORE_CUSTOM, JSON.stringify(customWords));
  } catch (e) {
    /* 무시 */
  }
}

// ----- DOM 헬퍼 -----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===================================================================
//  사운드 (WebAudio 합성 — 파일 없음) + 햅틱
// ===================================================================
let audioCtx = null;
function getAudio() {
  if (!settings.sound) return null;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

// 단음 재생 (주파수, 길이, 파형, 볼륨, 시작오프셋)
function beep(freq, dur, type, vol, when) {
  const ctx = getAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + (when || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function haptic(pattern) {
  if (settings.sound && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// 상황별 효과음 + 진동
function sfx(name) {
  switch (name) {
    case "tap":      beep(420, 0.06, "triangle", 0.12); break;
    case "flip":     beep(300, 0.07, "sine", 0.16); beep(520, 0.08, "sine", 0.12, 0.05); haptic(12); break;
    case "citizen":  beep(523, 0.12, "sine", 0.18); beep(784, 0.16, "sine", 0.16, 0.1); haptic(18); break;
    case "liar":     beep(330, 0.18, "sawtooth", 0.16); beep(196, 0.32, "sawtooth", 0.16, 0.12); haptic([0, 30, 40, 60]); break;
    case "spy":      beep(440, 0.14, "triangle", 0.16); beep(370, 0.2, "triangle", 0.14, 0.1); haptic([0, 20, 30, 30]); break;
    case "vote":     beep(600, 0.06, "square", 0.1); haptic(10); break;
    case "drumroll": for (let i = 0; i < 10; i++) beep(180 + i * 4, 0.05, "triangle", 0.09, i * 0.07); haptic([0, 15, 25, 15, 25, 15, 25, 15]); break;
    case "win":      [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, "sine", 0.2, i * 0.12)); haptic([0, 40, 50, 40, 50, 80]); break;
    case "lose":     [392, 330, 262].forEach((f, i) => beep(f, 0.26, "sawtooth", 0.16, i * 0.14)); haptic([0, 60, 40, 120]); break;
  }
}

// ===================================================================
//  설정 화면
// ===================================================================
function initSetup() {
  const hadSaved = loadSettings();
  loadScore();
  loadCustom();

  // 테마 적용 + 선택 UI
  applyTheme(settings.theme);
  renderThemePicker();

  // 새로 추가된 기본 팩은 자동으로 켜기 (최초 노출 시 1회)
  Object.keys(WORD_BANK).forEach((c) => {
    if (!settings.seenCats.includes(c)) {
      settings.seenCats.push(c);
      if (hadSaved && !settings.categories.includes(c)) settings.categories.push(c);
    }
  });
  // 첫 실행이면 모든 카테고리 선택
  if (!hadSaved) settings.categories = Object.keys(getBank());
  saveSettings();
  renderCategoryChips();

  // 스테퍼
  $("#player-minus").addEventListener("click", () => changePlayers(-1));
  $("#player-plus").addEventListener("click", () => changePlayers(1));
  $("#liar-minus").addEventListener("click", () => changeLiars(-1));
  $("#liar-plus").addEventListener("click", () => changeLiars(1));

  // 옵션 (저장된 값으로 체크 상태 복원)
  bindToggle("#opt-spy", "spyMode");
  bindToggle("#opt-comeback", "comeback");
  bindToggle("#opt-timer", "timer");
  bindToggle("#opt-easy", "easy");
  bindToggle("#opt-sound", "sound");

  $("#btn-start").addEventListener("click", () => { sfx("tap"); startGame(); });
  $("#btn-reset-score").addEventListener("click", resetScore);
  $("#btn-edit-words").addEventListener("click", openEditor);

  // 게임 방법 (온보딩) — 최초 1회 자동 표시
  $("#btn-help").addEventListener("click", openHelp);
  $("#help-close").addEventListener("click", closeHelp);
  if (!hadSaved) openHelp();

  renderCounts();
  renderNameInputs();
  renderScoreboard();
}

function openHelp() { $("#help-overlay").classList.remove("hidden"); }
function closeHelp() { sfx("tap"); $("#help-overlay").classList.add("hidden"); }

// 카테고리 칩 다시 그리기 (사용자 단어 추가 후에도 호출)
function renderCategoryChips() {
  const catList = $("#category-list");
  catList.innerHTML = "";
  Object.keys(getBank()).forEach((cat) => {
    const selected = settings.categories.includes(cat);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (selected ? " selected" : "");
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
      syncCategories();
      saveSettings();
    });
    catList.appendChild(chip);
  });
  syncCategories();
}

// 테마 적용 (html data-theme + 주소창 색)
function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.setAttribute("data-theme", theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.id === "dark" ? "#1b1b21" : theme.color);
}

function renderThemePicker() {
  const list = $("#theme-list");
  if (!list) return;
  list.innerHTML = "";
  THEMES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-swatch" + (settings.theme === t.id ? " selected" : "");
    btn.setAttribute("aria-label", t.name);

    const dot = document.createElement("span");
    dot.className = "theme-dot";
    dot.style.background = t.color;

    const name = document.createElement("span");
    name.className = "theme-name";
    name.textContent = t.name;

    btn.appendChild(dot);
    btn.appendChild(name);
    btn.addEventListener("click", () => {
      settings.theme = t.id;
      applyTheme(t.id);
      saveSettings();
      $$("#theme-list .theme-swatch").forEach((s) => s.classList.remove("selected"));
      btn.classList.add("selected");
    });
    list.appendChild(btn);
  });
}

function bindToggle(sel, key) {
  const el = $(sel);
  if (!el) return;
  el.checked = settings[key];
  el.addEventListener("change", (e) => {
    settings[key] = e.target.checked;
    saveSettings();
  });
}

function syncCategories() {
  settings.categories = $$("#category-list .chip.selected").map((c) => c.textContent);
  if (settings.categories.length > 0) {
    const warn = $("#cat-warning");
    if (warn) warn.classList.add("hidden");
  }
}

function changePlayers(delta) {
  settings.playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, settings.playerCount + delta));
  // 라이어 수는 항상 (플레이어 수 - 1) 이하
  settings.liarCount = Math.min(settings.liarCount, settings.playerCount - 1);
  renderCounts();
  renderNameInputs();
  saveSettings();
}

function changeLiars(delta) {
  const maxLiars = settings.playerCount - 1;
  settings.liarCount = Math.min(maxLiars, Math.max(1, settings.liarCount + delta));
  renderCounts();
  saveSettings();
}

function renderCounts() {
  $("#player-count").textContent = settings.playerCount;
  $("#liar-count").textContent = settings.liarCount;
}

// 플레이어 i의 표시 이름 (비어 있으면 "플레이어 N")
function getPlayerName(i) {
  const n = settings.playerNames[i];
  return n && n.trim() ? n.trim() : `플레이어 ${i + 1}`;
}

// 플레이어 수에 맞춰 이름 입력칸 다시 그리기
function renderNameInputs() {
  const list = $("#name-list");
  if (!list) return;
  list.innerHTML = "";
  for (let i = 0; i < settings.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "name-row";

    const num = document.createElement("span");
    num.className = "name-num";
    num.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "name-input";
    input.value = settings.playerNames[i] || "";
    input.placeholder = `플레이어 ${i + 1}`;
    input.maxLength = 12;
    input.addEventListener("input", () => {
      settings.playerNames[i] = input.value;
      saveSettings();
    });

    row.appendChild(num);
    row.appendChild(input);
    list.appendChild(row);
  }
}

// ===================================================================
//  점수판
// ===================================================================
function renderScoreboard() {
  const board = $("#scoreboard");
  if (!board) return;
  $("#score-citizens").textContent = score.citizens;
  $("#score-liars").textContent = score.liars;
  $("#score-round").textContent = score.round;
  board.classList.toggle("hidden", score.round === 0);
}

function resetScore() {
  score.citizens = 0;
  score.liars = 0;
  score.round = 0;
  saveScore();
  renderScoreboard();
}

// ===================================================================
//  게임 시작 / 역할 분배
// ===================================================================
function startGame() {
  if (settings.categories.length === 0) {
    const warn = $("#cat-warning");
    if (warn) {
      warn.textContent = "카테고리를 하나 이상 선택해 주세요";
      warn.classList.remove("hidden");
      warn.classList.remove("shake");
      void warn.offsetWidth; // 리플로우로 애니메이션 재시작
      warn.classList.add("shake");
    }
    return;
  }
  const warn = $("#cat-warning");
  if (warn) warn.classList.add("hidden");

  const bank = getBank();
  // 선택된 카테고리 중 단어가 실제로 있는 것만 사용
  const usable = settings.categories.filter((c) => bank[c] && bank[c].length > 0);
  if (usable.length === 0) {
    const warn = $("#cat-warning");
    if (warn) {
      warn.textContent = "선택한 카테고리에 단어가 없어요";
      warn.classList.remove("hidden");
    }
    return;
  }

  const category = pick(usable);
  // 같은 단어 연속 출제 방지 (선택지가 2개 이상일 때 직전 단어는 다시 뽑지 않음)
  const poolAll = bank[category];
  const pool = poolAll.filter((e) => e.word !== lastWord);
  const entry = pick(pool.length > 0 ? pool : poolAll);
  lastWord = entry.word;

  // 스파이 단어 결정 (사용자 단어가 스파이 미입력이면 같은 카테고리의 다른 단어로 대체)
  let spyWord = entry.spy;
  if (!spyWord) {
    const others = poolAll.filter((e) => e.word !== entry.word);
    spyWord = others.length > 0 ? pick(others).word : entry.word;
  }

  // 라이어 인덱스 선정
  const indices = shuffle([...Array(settings.playerCount).keys()]);
  const liarSet = new Set(indices.slice(0, settings.liarCount));

  // 각 플레이어 역할 구성
  const players = [];
  for (let i = 0; i < settings.playerCount; i++) {
    const isLiar = liarSet.has(i);
    players.push({
      id: i,
      name: getPlayerName(i),
      isLiar,
      // 시민: 제시어 / 스파이모드 라이어: 비슷한 단어 / 기본 라이어: 없음
      word: isLiar ? (settings.spyMode ? spyWord : null) : entry.word,
    });
  }

  game = {
    category,
    word: entry.word,
    spyWord: spyWord,
    players,
    revealIndex: 0,
    votedId: null,
  };

  startReveal();
}

// ===================================================================
//  역할 확인 (돌려쓰기)
// ===================================================================
function initReveal() {
  const card = $("#role-card");
  card.addEventListener("click", () => {
    if (card.classList.contains("flipped")) return;
    if (!game || game.revealIndex >= game.players.length) return;
    // 제시어/역할은 "탭하는 순간"에만 카드에 채운다 (전달 중 엿보기 방지)
    fillCardContent(game.players[game.revealIndex]);
    card.classList.add("flipped");
    sfx("flip"); // 모든 역할 동일 효과음
    $("#btn-reveal-next").classList.remove("hidden");
  });
  $("#btn-reveal-next").addEventListener("click", () => { sfx("tap"); nextReveal(); });
}

function startReveal() {
  game.revealIndex = 0;
  showScreen("screen-reveal");
  setupHandoff();
}

// 다음 사람에게 넘기는 상태: 카드 앞면(face-down) + 뒷면 내용 비움
function setupHandoff() {
  const i = game.revealIndex;
  const p = game.players[i];
  const card = $("#role-card");
  card.classList.remove("flipped");
  clearCardContent(); // 전달 애니메이션 동안 뒷면은 항상 비어 있음
  $("#btn-reveal-next").classList.add("hidden");
  $("#reveal-progress").textContent = `${i + 1} / ${game.players.length}`;
  $("#reveal-handoff").textContent = `${p.name}, 폰을 받으세요`;
}

// 카드 뒷면 내용 제거 (보안)
function clearCardContent() {
  const card = $("#role-card");
  card.classList.remove("role-citizen", "role-liar", "role-spy");
  $("#role-label").textContent = "";
  $("#role-word").textContent = "";
  $("#role-desc").textContent = "";
}

// 현재 플레이어의 역할/제시어를 카드 뒷면에 채움
function fillCardContent(p) {
  const card = $("#role-card");
  card.classList.remove("role-citizen", "role-liar", "role-spy");
  card.classList.add(!p.isLiar ? "role-citizen" : p.word === null ? "role-liar" : "role-spy");

  if (p.isLiar && p.word === null) {
    // 기본 모드 라이어 — 제시어를 절대 보여주지 않음
    $("#role-label").textContent = "🤫 당신은";
    $("#role-word").textContent = "라이어";
    $("#role-desc").textContent = settings.easy
      ? `힌트! 주제는 "${game.category}" 예요.\n제시어는 모르니 눈치껏 둘러대세요!`
      : "제시어를 모릅니다. 들키지 않게 둘러대세요!";
  } else if (p.isLiar) {
    // 스파이 모드 라이어
    $("#role-label").textContent = "🕵️ 당신의 단어 (스파이)";
    $("#role-word").textContent = p.word;
    $("#role-desc").textContent = "남들과 단어가 다를 수 있어요. 티 내지 마세요!";
  } else {
    // 시민
    $("#role-label").textContent = "🟢 당신의 제시어";
    $("#role-word").textContent = p.word;
    $("#role-desc").textContent = "라이어가 못 알아채게 설명하세요.";
  }
}

function nextReveal() {
  game.revealIndex++;
  if (game.revealIndex >= game.players.length) {
    startDiscuss();
  } else {
    setupHandoff();
  }
}

// ===================================================================
//  토론
// ===================================================================
function initDiscuss() {
  $("#btn-to-vote").addEventListener("click", () => {
    sfx("tap");
    stopTimer();
    startVote();
  });
}

function startDiscuss() {
  showScreen("screen-discuss");
  renderSpeakOrder();
  const display = $("#timer-display");
  if (settings.timer) {
    display.classList.remove("hidden");
    startTimer(DEFAULT_TIMER);
  } else {
    display.classList.add("hidden");
  }
}

// 모두 확인 후 무작위 설명 순서 안내 (역할 확인 순서와 무관)
function renderSpeakOrder() {
  const el = $("#speak-order");
  if (!el) return;
  el.innerHTML = "";
  const order = shuffle(game.players);
  order.forEach((p, i) => {
    const chip = document.createElement("span");
    chip.className = "speak-chip" + (i === 0 ? " first" : "");
    chip.textContent = p.name;
    el.appendChild(chip);
    if (i < order.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "speak-arrow";
      arrow.textContent = "→";
      el.appendChild(arrow);
    }
  });
}

function startTimer(seconds) {
  stopTimer();
  let remaining = seconds;
  const display = $("#timer-display");
  const render = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    display.textContent = `${m}:${String(s).padStart(2, "0")}`;
    display.classList.toggle("warn", remaining <= 30);
  };
  render();
  timerId = setInterval(() => {
    remaining--;
    render();
    if (remaining <= 0) {
      stopTimer();
      display.textContent = "시간 종료!";
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ===================================================================
//  투표
// ===================================================================
function initVote() {
  $("#vote-ready").addEventListener("click", () => { sfx("tap"); showVoteChoose(); });
  $("#vote-reveal-btn").addEventListener("click", () => {
    sfx("drumroll");
    const btn = $("#vote-reveal-btn");
    btn.disabled = true;
    setTimeout(() => {
      btn.disabled = false;
      if (game.votedId === null) showResult(false, false); // 동점 → 라이어 승
      else resolveResult();
    }, 850);
  });
}

function startVote() {
  game.votedId = null;
  game.voteCounts = game.players.map(() => 0);
  game.voterIndex = 0;
  game.tieRound = 0;
  $("#vote-sub").textContent = "한 명씩 돌아가며 비밀 투표해요";
  showScreen("screen-vote");
  showVoteHandoff();
}

// 다음 투표자에게 넘기는 화면
function showVoteHandoff() {
  if (game.voterIndex >= game.players.length) { tallyVotes(); return; }
  const voter = game.players[game.voterIndex];
  $("#vote-handoff").classList.remove("hidden");
  $("#vote-choose").classList.add("hidden");
  $("#vote-outcome").classList.add("hidden");
  $("#vote-progress").textContent = `${game.voterIndex + 1} / ${game.players.length}`;
  $("#vote-voter").textContent = `${voter.name} 차례`;
}

// 후보 선택 화면 (자기 자신 제외)
function showVoteChoose() {
  const voter = game.players[game.voterIndex];
  $("#vote-handoff").classList.add("hidden");
  $("#vote-choose").classList.remove("hidden");
  $("#vote-choose-label").textContent = `${voter.name} 님, 라이어로 의심되는 사람은?`;
  const list = $("#vote-list");
  list.innerHTML = "";
  game.players.forEach((p) => {
    if (p.id === voter.id) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = p.name;
    chip.addEventListener("click", () => castVote(p.id));
    list.appendChild(chip);
  });
}

function castVote(targetId) {
  game.voteCounts[targetId] += 1;
  sfx("vote");
  game.voterIndex += 1;
  showVoteHandoff();
}

function tallyVotes() {
  const counts = game.voteCounts;
  const max = Math.max(...counts);
  const top = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
  if (top.length === 1) {
    showVoteOutcome(top[0], counts);
  } else {
    game.tieRound += 1;
    if (game.tieRound >= 2) {
      showVoteOutcome(null, counts); // 두 번 동점 → 지목 실패
    } else {
      $("#vote-sub").textContent = "동점이에요! 한 번 더 투표해요";
      game.voteCounts = game.players.map(() => 0);
      game.voterIndex = 0;
      showVoteHandoff();
    }
  }
}

// 집계 결과(막대) 공개
function showVoteOutcome(votedId, counts) {
  game.votedId = votedId;
  $("#vote-handoff").classList.add("hidden");
  $("#vote-choose").classList.add("hidden");
  $("#vote-outcome").classList.remove("hidden");
  $("#vote-sub").textContent = votedId === null ? "동점! 아무도 지목하지 못했어요" : "가장 의심받은 사람은…";

  const tally = $("#vote-tally");
  tally.innerHTML = "";
  const max = Math.max(1, ...counts);
  game.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "tally-row" + (p.id === votedId ? " top" : "");

    const name = document.createElement("span");
    name.className = "tally-name";
    name.textContent = p.name;

    const bar = document.createElement("span");
    bar.className = "tally-bar";
    const fill = document.createElement("span");
    fill.className = "tally-fill";
    fill.style.width = (counts[p.id] / max) * 100 + "%";
    bar.appendChild(fill);

    const num = document.createElement("span");
    num.className = "tally-num";
    num.textContent = counts[p.id];

    row.appendChild(name);
    row.appendChild(bar);
    row.appendChild(num);
    tally.appendChild(row);
  });
}

// ===================================================================
//  결과 판정
// ===================================================================
function resolveResult() {
  const voted = game.players[game.votedId];

  if (voted.isLiar) {
    // 라이어를 지목함
    if (settings.comeback) {
      // 역전 기회 화면으로
      startComeback(voted);
    } else {
      showResult(true, false); // 시민 승
    }
  } else {
    // 시민을 지목함 → 라이어 승
    showResult(false, false);
  }
}

function initComeback() {
  // 후보 버튼은 startComeback에서 동적으로 생성/바인딩
}

function startComeback(votedLiar) {
  showScreen("screen-comeback");
  game.comebackDone = false;
  $("#comeback-name").textContent = votedLiar.name;
  const msg = $("#comeback-result");
  msg.classList.add("hidden");
  msg.textContent = "";

  // 후보 구성: 정답 1개 + 오답 9개 (같은 카테고리 우선, 부족하면 다른 카테고리)
  const bank = getBank();
  let pool = (bank[game.category] || []).map((e) => e.word).filter((w) => w !== game.word);
  if (pool.length < 9) {
    const all = [];
    Object.values(bank).forEach((arr) => arr.forEach((e) => { if (e.word !== game.word) all.push(e.word); }));
    pool = pool.concat(all);
  }
  pool = [...new Set(pool)];
  const options = shuffle([game.word, ...shuffle(pool).slice(0, 9)]);

  const box = $("#comeback-options");
  box.innerHTML = "";
  options.forEach((w) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "comeback-opt";
    btn.textContent = w;
    btn.addEventListener("click", () => onComebackPick(w, btn));
    box.appendChild(btn);
  });
}

// 라이어가 후보를 선택했을 때
function onComebackPick(word, btn) {
  if (game.comebackDone) return;
  game.comebackDone = true;
  const correct = word === game.word;

  $$("#comeback-options .comeback-opt").forEach((b) => {
    b.disabled = true;
    if (b.textContent === game.word) b.classList.add("correct"); // 정답 위치 공개
  });
  if (!correct) btn.classList.add("wrong");
  sfx(correct ? "liar" : "vote");

  const msg = $("#comeback-result");
  msg.classList.remove("hidden");
  msg.textContent = correct ? "정답! 라이어 역전승 🔥" : `땡! 정답은 "${game.word}"`;

  setTimeout(() => showResult(!correct, correct), 1400);
}

// citizensWin: 시민 승리 여부 / byComeback: 라이어 역전승 여부
function showResult(citizensWin, byComeback) {
  showScreen("screen-result");

  const liarNames = game.players.filter((p) => p.isLiar).map((p) => p.name).join(", ");

  // 승패에 따른 연출 (컨페티/색상)
  const resultScreen = $("#screen-result");
  resultScreen.classList.toggle("win", citizensWin);
  resultScreen.classList.toggle("lose", !citizensWin);

  if (citizensWin) {
    $("#result-title").textContent = "🎉 시민 승리!";
  } else if (byComeback) {
    $("#result-title").textContent = "🔥 라이어 역전승!";
  } else {
    $("#result-title").textContent = "😈 라이어 승리!";
  }
  sfx(citizensWin ? "win" : "lose");

  $("#result-word").textContent = game.word;
  $("#result-category").textContent = `(${game.category})`;
  $("#result-liars").textContent = liarNames;

  const spyEl = $("#result-spy");
  if (settings.spyMode) {
    spyEl.classList.remove("hidden");
    spyEl.innerHTML = `라이어 단어(스파이): <b>${game.spyWord}</b>`;
  } else {
    spyEl.classList.add("hidden");
  }

  // 누적 점수 갱신 (라운드당 한 번만)
  if (!game.scored) {
    game.scored = true;
    score.round += 1;
    if (citizensWin) score.citizens += 1;
    else score.liars += 1;
    saveScore();
  }
  $("#result-score-citizens").textContent = score.citizens;
  $("#result-score-liars").textContent = score.liars;
  $("#result-round").textContent = `· ${score.round}라운드`;
  renderScoreboard();
}

function initResult() {
  $("#btn-replay").addEventListener("click", () => { sfx("tap"); startGame(); });
  $("#btn-home").addEventListener("click", () => {
    sfx("tap");
    stopTimer();
    showScreen("screen-setup");
  });
}

// ===================================================================
//  제시어 편집기
// ===================================================================
function initEditor() {
  $("#btn-add-word").addEventListener("click", addOrUpdateWord);
  $("#btn-edit-cancel").addEventListener("click", cancelEdit);
  $("#btn-clear-words").addEventListener("click", clearAllCustom);
  $("#btn-export").addEventListener("click", exportCustom);
  $("#btn-import").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", handleImportFile);
  $("#btn-editor-back").addEventListener("click", () => {
    cancelEdit();
    renderCategoryChips(); // 새 카테고리 반영
    showScreen("screen-setup");
  });
}

function openEditor() {
  cancelEdit();
  renderCatOptions();
  renderCustomList();
  showScreen("screen-editor");
}

// 카테고리 입력 자동완성 목록 (기존 카테고리)
function renderCatOptions() {
  const dl = $("#cat-options");
  dl.innerHTML = "";
  Object.keys(getBank()).forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    dl.appendChild(opt);
  });
}

function showEditWarn(msg) {
  const w = $("#edit-warning");
  w.textContent = msg;
  w.classList.remove("hidden", "shake");
  void w.offsetWidth;
  w.classList.add("shake");
}

function addOrUpdateWord() {
  const cat = $("#edit-category").value.trim();
  const word = $("#edit-word").value.trim();
  const spy = $("#edit-spy").value.trim();

  if (!cat || !word) {
    showEditWarn("카테고리와 제시어를 입력해줘! 🥺");
    return;
  }

  // 편집 중이면 기존 항목 제거 후 다시 추가 (카테고리 변경도 지원)
  if (editingRef) {
    removeEntry(editingRef.cat, editingRef.index);
    editingRef = null;
  }

  if (!customWords[cat]) customWords[cat] = [];
  customWords[cat].push({ word, spy });
  saveCustom();

  // 새 카테고리라면 선택 목록에 추가
  if (!settings.categories.includes(cat)) {
    settings.categories.push(cat);
    saveSettings();
  }

  // 입력칸 정리 (카테고리는 연속 입력 편하게 유지)
  $("#edit-word").value = "";
  $("#edit-spy").value = "";
  $("#edit-warning").classList.add("hidden");
  $("#btn-add-word").textContent = "추가하기";
  $("#btn-edit-cancel").classList.add("hidden");

  renderCatOptions();
  renderCustomList();
  $("#edit-word").focus();
}

function startEditEntry(cat, index) {
  const entry = customWords[cat][index];
  if (!entry) return;
  editingRef = { cat, index };
  $("#edit-category").value = cat;
  $("#edit-word").value = entry.word;
  $("#edit-spy").value = entry.spy || "";
  $("#btn-add-word").textContent = "수정 완료";
  $("#btn-edit-cancel").classList.remove("hidden");
  $("#edit-warning").classList.add("hidden");
  $("#edit-word").focus();
}

function cancelEdit() {
  editingRef = null;
  $("#edit-word").value = "";
  $("#edit-spy").value = "";
  $("#btn-add-word").textContent = "추가하기";
  $("#btn-edit-cancel").classList.add("hidden");
  $("#edit-warning").classList.add("hidden");
}

// 내부: 항목 제거 (빈 카테고리는 정리)
function removeEntry(cat, index) {
  if (!customWords[cat]) return;
  customWords[cat].splice(index, 1);
  if (customWords[cat].length === 0) {
    delete customWords[cat];
    // 기본 단어가 없는 순수 사용자 카테고리였다면 선택 목록에서도 제거
    if (!WORD_BANK[cat]) {
      settings.categories = settings.categories.filter((c) => c !== cat);
      saveSettings();
    }
  }
  saveCustom();
}

function deleteEntry(cat, index) {
  removeEntry(cat, index);
  // 편집 중이던 항목을 지웠다면 폼 초기화
  if (editingRef && editingRef.cat === cat) cancelEdit();
  renderCatOptions();
  renderCustomList();
}

function clearAllCustom() {
  if (Object.keys(customWords).length === 0) return;
  if (!confirm("내가 추가한 단어를 모두 삭제할까요?")) return;
  // 순수 사용자 카테고리는 선택 목록에서 제거
  for (const cat of Object.keys(customWords)) {
    if (!WORD_BANK[cat]) settings.categories = settings.categories.filter((c) => c !== cat);
  }
  customWords = {};
  saveCustom();
  saveSettings();
  cancelEdit();
  renderCatOptions();
  renderCustomList();
}

// ----- 내보내기/가져오기 -----
function ioMsg(msg, ok) {
  const el = $("#io-msg");
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#15795e" : "";
  el.classList.remove("hidden", "shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function exportCustom() {
  if (Object.keys(customWords).length === 0) {
    ioMsg("내보낼 단어가 없어요 🥺", false);
    return;
  }
  try {
    const blob = new Blob([JSON.stringify(customWords, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "라이어-제시어.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ioMsg("파일로 내보냈어요! 📤", true);
  } catch (e) {
    ioMsg("내보내기에 실패했어요 😢", false);
  }
}

// 텍스트(JSON)를 받아 기존 단어에 병합. 추가된 개수 반환
function importCustomFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    ioMsg("파일을 읽을 수 없어요 (형식 오류) 😢", false);
    return 0;
  }
  const incoming = sanitizeCustom(parsed);
  let added = 0;
  for (const cat of Object.keys(incoming)) {
    if (!customWords[cat]) customWords[cat] = [];
    const seen = new Set(customWords[cat].map((e) => e.word + "|" + e.spy));
    for (const e of incoming[cat]) {
      const key = e.word + "|" + e.spy;
      if (!seen.has(key)) {
        customWords[cat].push(e);
        seen.add(key);
        added++;
      }
    }
    if (!settings.categories.includes(cat)) settings.categories.push(cat);
  }
  if (added > 0) {
    saveCustom();
    saveSettings();
    renderCatOptions();
    renderCustomList();
  }
  ioMsg(added > 0 ? `${added}개 단어를 가져왔어요! 📥` : "새로 가져올 단어가 없었어요", added > 0);
  return added;
}

function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importCustomFromText(String(reader.result));
  reader.onerror = () => ioMsg("파일을 읽을 수 없어요 😢", false);
  reader.readAsText(file);
  e.target.value = ""; // 같은 파일 다시 선택 가능하도록 초기화
}

function renderCustomList() {
  const list = $("#custom-list");
  list.innerHTML = "";
  const cats = Object.keys(customWords);
  if (cats.length === 0) {
    const empty = document.createElement("p");
    empty.className = "custom-empty";
    empty.textContent = "아직 추가한 단어가 없어요. 위에서 만들어 보세요! ✨";
    list.appendChild(empty);
    return;
  }
  cats.forEach((cat) => {
    const group = document.createElement("div");
    group.className = "custom-group";
    const head = document.createElement("div");
    head.className = "custom-cat";
    head.textContent = cat;
    group.appendChild(head);

    customWords[cat].forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "custom-item";

      const text = document.createElement("span");
      text.className = "custom-text";
      text.textContent = entry.spy ? `${entry.word}  ↔  ${entry.spy}` : entry.word;
      item.appendChild(text);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "✏️";
      editBtn.setAttribute("aria-label", "수정");
      editBtn.addEventListener("click", () => startEditEntry(cat, index));
      item.appendChild(editBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn";
      delBtn.textContent = "🗑️";
      delBtn.setAttribute("aria-label", "삭제");
      delBtn.addEventListener("click", () => deleteEntry(cat, index));
      item.appendChild(delBtn);

      group.appendChild(item);
    });
    list.appendChild(group);
  });
}

// ===================================================================
//  부트스트랩
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSetup();
  initReveal();
  initDiscuss();
  initVote();
  initComeback();
  initResult();
  initEditor();
  showScreen("screen-setup");

  // PWA: 서비스 워커 등록 (http/https에서만, file://에서는 건너뜀)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
