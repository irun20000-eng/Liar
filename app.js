// ===== 라이어 게임 (한 기기 돌려쓰기) =====
"use strict";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DEFAULT_TIMER = 180; // 3분

// ----- 설정 상태 -----
const settings = {
  playerCount: 4,
  liarCount: 1,
  categories: [], // 선택된 카테고리 이름들
  spyMode: false,
  comeback: true,
  timer: false,
};

// ----- 진행 중 게임 상태 -----
let game = null;
let timerId = null;

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
  // 카테고리 칩 생성 (기본: 전부 선택)
  const catList = $("#category-list");
  catList.innerHTML = "";
  Object.keys(WORD_BANK).forEach((cat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip selected";
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
      syncCategories();
    });
    catList.appendChild(chip);
  });
  syncCategories();

  // 스테퍼
  $("#player-minus").addEventListener("click", () => changePlayers(-1));
  $("#player-plus").addEventListener("click", () => changePlayers(1));
  $("#liar-minus").addEventListener("click", () => changeLiars(-1));
  $("#liar-plus").addEventListener("click", () => changeLiars(1));

  // 옵션
  $("#opt-spy").addEventListener("change", (e) => (settings.spyMode = e.target.checked));
  $("#opt-comeback").addEventListener("change", (e) => (settings.comeback = e.target.checked));
  $("#opt-timer").addEventListener("change", (e) => (settings.timer = e.target.checked));

  $("#btn-start").addEventListener("click", startGame);

  renderCounts();
}

function syncCategories() {
  settings.categories = $$("#category-list .chip.selected").map((c) => c.textContent);
}

function changePlayers(delta) {
  settings.playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, settings.playerCount + delta));
  // 라이어 수는 항상 (플레이어 수 - 1) 이하
  settings.liarCount = Math.min(settings.liarCount, settings.playerCount - 1);
  renderCounts();
}

function changeLiars(delta) {
  const maxLiars = settings.playerCount - 1;
  settings.liarCount = Math.min(maxLiars, Math.max(1, settings.liarCount + delta));
  renderCounts();
}

function renderCounts() {
  $("#player-count").textContent = settings.playerCount;
  $("#liar-count").textContent = settings.liarCount;
}

// ===================================================================
//  게임 시작 / 역할 분배
// ===================================================================
function startGame() {
  if (settings.categories.length === 0) {
    alert("카테고리를 하나 이상 선택해주세요!");
    return;
  }

  const category = pick(settings.categories);
  const entry = pick(WORD_BANK[category]);

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
    $("#role-desc").textContent = "제시어를 모릅니다. 들키지 않게 둘러대세요!";
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
