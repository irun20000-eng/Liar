// ===== 라이어 게임 (한 기기 돌려쓰기) =====
"use strict";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TIMER = 180; // 3분
const STORE_SETTINGS = "liar.settings.v1";
const STORE_SCORE = "liar.score.v1";

// ----- 설정 상태 -----
const settings = {
  playerCount: 4,
  liarCount: 1,
  categories: [], // 선택된 카테고리 이름들
  spyMode: false,
  comeback: true,
  timer: false,
  easy: true, // 쉬움 모드: 라이어에게 카테고리 힌트 제공
};

// ----- 누적 점수판 -----
const score = { citizens: 0, liars: 0, round: 0 };

// ----- 진행 중 게임 상태 -----
let game = null;
let timerId = null;
let lastWord = null; // 같은 단어 연속 출제 방지용

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
//  설정 화면
// ===================================================================
function initSetup() {
  const hadSaved = loadSettings();
  loadScore();

  // 카테고리 칩 생성 (저장된 선택 복원, 첫 실행이면 전부 선택)
  const catList = $("#category-list");
  catList.innerHTML = "";
  Object.keys(WORD_BANK).forEach((cat) => {
    const selected = hadSaved ? settings.categories.includes(cat) : true;
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

  $("#btn-start").addEventListener("click", startGame);
  $("#btn-reset-score").addEventListener("click", resetScore);

  renderCounts();
  renderScoreboard();
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
      warn.classList.remove("hidden");
      warn.classList.remove("shake");
      void warn.offsetWidth; // 리플로우로 애니메이션 재시작
      warn.classList.add("shake");
    }
    return;
  }
  const warn = $("#cat-warning");
  if (warn) warn.classList.add("hidden");

  const category = pick(settings.categories);
  // 같은 단어 연속 출제 방지 (선택지가 2개 이상일 때 직전 단어는 다시 뽑지 않음)
  const poolAll = WORD_BANK[category];
  const pool = poolAll.filter((e) => e.word !== lastWord);
  const entry = pick(pool.length > 0 ? pool : poolAll);
  lastWord = entry.word;

  // 라이어 인덱스 선정
  const indices = shuffle([...Array(settings.playerCount).keys()]);
  const liarSet = new Set(indices.slice(0, settings.liarCount));

  // 각 플레이어 역할 구성
  const players = [];
  for (let i = 0; i < settings.playerCount; i++) {
    const isLiar = liarSet.has(i);
    players.push({
      id: i,
      name: `플레이어 ${i + 1}`,
      isLiar,
      // 시민: 제시어 / 스파이모드 라이어: 비슷한 단어 / 기본 라이어: 없음
      word: isLiar ? (settings.spyMode ? entry.spy : null) : entry.word,
    });
  }

  game = {
    category,
    word: entry.word,
    spyWord: entry.spy,
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
    card.classList.add("flipped");
    $("#btn-reveal-next").classList.remove("hidden");
  });
  $("#btn-reveal-next").addEventListener("click", nextReveal);
}

function startReveal() {
  game.revealIndex = 0;
  showScreen("screen-reveal");
  renderRevealCard();
}

function renderRevealCard() {
  const i = game.revealIndex;
  const p = game.players[i];
  const card = $("#role-card");

  card.classList.remove("flipped");
  $("#btn-reveal-next").classList.add("hidden");
  $("#reveal-progress").textContent = `${i + 1} / ${game.players.length}`;
  $("#reveal-handoff").textContent = `${p.name}, 폰을 받으세요`;

  // 뒷면 내용 채우기
  if (p.isLiar && p.word === null) {
    // 기본 모드 라이어
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
    renderRevealCard();
  }
}

// ===================================================================
//  토론
// ===================================================================
function initDiscuss() {
  $("#btn-to-vote").addEventListener("click", () => {
    stopTimer();
    startVote();
  });
}

function startDiscuss() {
  showScreen("screen-discuss");
  const display = $("#timer-display");
  if (settings.timer) {
    display.classList.remove("hidden");
    startTimer(DEFAULT_TIMER);
  } else {
    display.classList.add("hidden");
  }
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
  $("#btn-reveal-result").addEventListener("click", () => {
    if (game.votedId === null) return;
    resolveResult();
  });
}

function startVote() {
  game.votedId = null;
  showScreen("screen-vote");
  const list = $("#vote-list");
  list.innerHTML = "";
  game.players.forEach((p) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = p.name;
    chip.addEventListener("click", () => {
      game.votedId = p.id;
      $$("#vote-list .chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      $("#btn-reveal-result").disabled = false;
    });
    list.appendChild(chip);
  });
  $("#btn-reveal-result").disabled = true;
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
  $("#btn-comeback-show").addEventListener("click", () => {
    $("#comeback-word").textContent = game.word;
    $("#btn-comeback-show").classList.add("hidden");
    $("#comeback-answer").classList.remove("hidden");
  });
  $("#btn-comeback-yes").addEventListener("click", () => showResult(false, true)); // 라이어 역전승
  $("#btn-comeback-no").addEventListener("click", () => showResult(true, false));  // 시민 승
}

function startComeback(votedLiar) {
  showScreen("screen-comeback");
  $("#comeback-name").textContent = votedLiar.name;
  $("#btn-comeback-show").classList.remove("hidden");
  $("#comeback-answer").classList.add("hidden");
}

// citizensWin: 시민 승리 여부 / byComeback: 라이어 역전승 여부
function showResult(citizensWin, byComeback) {
  showScreen("screen-result");

  const liarNames = game.players.filter((p) => p.isLiar).map((p) => p.name).join(", ");

  if (citizensWin) {
    $("#result-title").textContent = "🎉 시민 승리!";
  } else if (byComeback) {
    $("#result-title").textContent = "🔥 라이어 역전승!";
  } else {
    $("#result-title").textContent = "😈 라이어 승리!";
  }

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
  $("#btn-replay").addEventListener("click", startGame);
  $("#btn-home").addEventListener("click", () => {
    stopTimer();
    showScreen("screen-setup");
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
  showScreen("screen-setup");
});
