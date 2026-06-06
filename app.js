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

function loadCustom() {
  try {
    const raw = localStorage.getItem(STORE_CUSTOM);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      // 형식 검증: { cat: [{word, spy}] }
      customWords = {};
      for (const cat of Object.keys(obj)) {
        if (!Array.isArray(obj[cat])) continue;
        const items = obj[cat]
          .filter((e) => e && typeof e.word === "string" && e.word.trim())
          .map((e) => ({ word: e.word.trim(), spy: (e.spy || "").trim() }));
        if (items.length) customWords[cat] = items;
      }
    }
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
//  설정 화면
// ===================================================================
function initSetup() {
  const hadSaved = loadSettings();
  loadScore();
  loadCustom();

  // 첫 실행이면 모든 카테고리 선택
  if (!hadSaved) settings.categories = Object.keys(getBank());
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

  $("#btn-start").addEventListener("click", startGame);
  $("#btn-reset-score").addEventListener("click", resetScore);
  $("#btn-edit-words").addEventListener("click", openEditor);

  renderCounts();
  renderScoreboard();
}

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
      warn.textContent = "카테고리를 하나 이상 골라줘! 🥺";
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
      warn.textContent = "선택한 카테고리에 단어가 없어요 🥺";
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
      name: `플레이어 ${i + 1}`,
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
  // 역할별 카드 색상 클래스 초기화 후 지정
  card.classList.remove("role-citizen", "role-liar", "role-spy");
  card.classList.add(!p.isLiar ? "role-citizen" : p.word === null ? "role-liar" : "role-spy");
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
//  제시어 편집기
// ===================================================================
function initEditor() {
  $("#btn-add-word").addEventListener("click", addOrUpdateWord);
  $("#btn-edit-cancel").addEventListener("click", cancelEdit);
  $("#btn-clear-words").addEventListener("click", clearAllCustom);
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
});
