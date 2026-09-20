/* ===== 서울 겨울 가족여행 플래너 — 앱 ===== */
(function () {
  'use strict';
  const T = window.TRIP, PLANS = window.PLANS;
  const byId = Object.fromEntries(T.places.map(p => [p.id, p]));
  const typeById = Object.fromEntries(T.types.map(t => [t.id, t]));
  const regionById = Object.fromEntries(T.regions.map(r => [r.id, r]));
  const dayById = Object.fromEntries(T.meta.days.map(d => [d.id, d]));
  const KEY = 'seoulTrip2027.v1';
  const planIdsOf = {}; PLANS.forEach(pl => Object.values(pl.days).forEach(d => d.forEach(sl => { if (sl.p) (planIdsOf[sl.p] = planIdsOf[sl.p] || new Set()).add(pl.id); })));

  /* ---------- 유틸 ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmtT = m => { if (m == null) return ''; m = Math.round(m); const h = Math.floor(m / 60) % 24, mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
  const won = n => n ? n.toLocaleString('ko-KR') + '원' : '무료';
  const familyCost = p => p.cost ? (p.cost.a * 2 + p.cost.t + p.cost.c * 2) : 0;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const km = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  function travelEst(a, b) {
    const d = km(a, b);
    if (d < 1.2) return { min: Math.round(d * 14) + 2, mode: '🚶 도보', km: d };
    const min = d <= 30 ? Math.round(10 + d * 2.3) : Math.round(15 + d * 1.15);
    return { min, mode: '🚗 자차', km: d };
  }
  const kakaoRoute = (a, b) => `https://map.kakao.com/link/from/${encodeURIComponent(a.name)},${a.lat},${a.lng}/to/${encodeURIComponent(b.name)},${b.lat},${b.lng}`;
  const kakaoTo = p => `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
  const kakaoSearch = p => `https://map.kakao.com/link/search/${encodeURIComponent(p.name.replace(/\s*\(.*$/, ''))}`;
  const naverSearch = p => `https://map.naver.com/p/search/${encodeURIComponent(p.name.replace(/\s*\(.*$/, ''))}`;

  // 한글 초성
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const choseong = s => Array.from(s).map(ch => { const c = ch.charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3) ? CHO[Math.floor((c - 0xAC00) / 588)] : ch; }).join('');
  const isChoQuery = q => /^[ㄱ-ㅎ\s]+$/.test(q);
  function matches(p, q) {
    q = q.trim().toLowerCase(); if (!q) return true;
    const name = p.name.toLowerCase();
    if (isChoQuery(q)) return choseong(name).includes(q.replace(/\s/g, ''));
    const hay = [p.name, p.why, p.tips, (p.tags || []).join(' '), regionById[p.region]?.label, typeById[p.type]?.label].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  /* ---------- 상태 ---------- */
  const defaults = () => ({
    theme: 'auto', vt: {}, mem: {}, checks: {}, sync: { kind: '', url: '', me: '', last: 0, err: '' },
    mine: Object.fromEntries(T.meta.days.map(d => [d.id, []])),
    mineStart: Object.fromEntries(T.meta.days.map(d => [d.id, d.start])),
    planId: 'A', planDay: 'd1', mineDay: 'd1', poolType: '', poolFilters: {}, poolSort: 'rec', poolRegion: '',
    budget: { stayId: 'stay_fraser', nightly: '', nights: 4, fuelEff: 12, fuelPrice: 1700, extraKm: 0, tolls: 20000, parkingPerDay: 15000, parkingDays: 3, mealB: 6000, mealL: 12000, mealD: 15000, snacks: 20000, reservePct: 10, scenario: 'base' }
  });
  let S = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = defaults(), o = JSON.parse(raw); S = Object.assign(d, o); S.budget = Object.assign(d.budget, o.budget || {}); S.sync = Object.assign(d.sync, o.sync || {}); if (!byId[S.budget.stayId]) S.budget.stayId = d.budget.stayId; } } catch (e) { /* 저장 불가 환경 */ }
  // 구버전(votes 배열 · members 이름) → vt/mem 마이그레이션
  if (S.votes && !Object.keys(S.vt || {}).length) { S.vt = {}; Object.entries(S.votes).forEach(([pid, arr]) => (arr || []).forEach(mid => { (S.vt[pid] = S.vt[pid] || {})[mid] = { on: true, ts: 1 }; })); }
  if (S.members && !Object.keys(S.mem || {}).length) { S.mem = {}; Object.entries(S.members).forEach(([mid, name]) => { if (name) S.mem[mid] = { name, ts: 1 }; }); }
  delete S.votes; delete S.members; S.vt = S.vt || {}; S.mem = S.mem || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const memberName = m => (S.mem[m.id] && S.mem[m.id].name) || m.name;
  const votedBy = pid => Object.entries(S.vt[pid] || {}).filter(([, v]) => v.on).map(([mid]) => mid);
  const voteCount = pid => votedBy(pid).length;
  function setVote(pid, mid, on) { (S.vt[pid] = S.vt[pid] || {})[mid] = { on, ts: Date.now() }; save(); if (typeof SYNC !== 'undefined') SYNC.markDirty(`vt/${pid}/${mid}`); }

  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 2200); }

  /* ---------- 테마 ---------- */
  function applyTheme() {
    const root = document.documentElement;
    if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
    $('#btn-theme').textContent = S.theme === 'dark' ? '☀️' : S.theme === 'light' ? '🌙' : '🌗';
  }
  $('#btn-theme').addEventListener('click', () => { S.theme = S.theme === 'auto' ? 'dark' : S.theme === 'dark' ? 'light' : 'auto'; save(); applyTheme(); toast(`테마: ${{ auto: '시스템', dark: '다크', light: '라이트' }[S.theme]}`); });
  $('#btn-print').addEventListener('click', () => window.print());

  /* ---------- 라우팅 ---------- */
  const TABS = ['home', 'pool', 'plans', 'mine', 'map'];
  function route() {
    let tab = (location.hash || '#home').slice(1).split('/')[0];
    if (!TABS.includes(tab)) tab = 'home';
    TABS.forEach(t => { $(`#view-${t}`).hidden = t !== tab; });
    $$('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    if (tab === 'map') showMap();
    window.scrollTo({ top: 0 });
  }
  window.addEventListener('hashchange', route);

  /* ---------- 일정 계산 (공통) ---------- */
  // slots: [{p?, title?, kind?, dur?, t?(추천안 고정시각), fixed?(내 일정 고정시각), act, note}]
  function computeDay(slots, day, startTime) {
    let cursor = toMin(startTime) ?? 9 * 60, prevPlace = null, lastWasMove = false;
    const rows = [];
    slots.forEach((s, i) => {
      const place = s.p ? byId[s.p] : null;
      const dur = s.dur != null ? Number(s.dur) : (place ? place.dur : 60);
      let travel = null;
      if (place && prevPlace && place !== prevPlace && !lastWasMove) {
        const est = travelEst(prevPlace, place);
        travel = Object.assign(est, { link: kakaoRoute(prevPlace, place), from: prevPlace, to: place });
      }
      const arrival = cursor + (travel ? travel.min : 0);
      const fixed = s.t || s.fixed || null;
      const start = fixed ? toMin(fixed) : arrival;
      const slack = fixed ? start - arrival : 0;
      const end = start + dur;
      const warns = [];
      if (place) {
        if ((place.closedDow || []).includes(day.dow)) warns.push({ k: 'warn', t: `${day.dow}요일 휴무` });
        if ((place.closedDates || []).includes(day.date)) warns.push({ k: 'warn', t: '해당일 미운영' });
        const oh = (place.ohByDow && place.ohByDow[day.dow]) || place.oh;
        if (oh && place.type !== 'stay') {
          const o = toMin(oh[0]), c = toMin(oh[1]);
          if (start < o - 20) warns.push({ k: 'warn', t: `개장 ${oh[0]} 전 도착` });
          if (end > c + 5 && place.type !== 'food') warns.push({ k: 'warn', t: `마감 ${oh[1]} 초과` });
          if (start >= c) warns.push({ k: 'warn', t: `마감 ${oh[1]} 이후 도착` });
        }
      }
      rows.push({ i, slot: s, place, dur, travel, start, end, arrival, slack, warns, fixed: !!fixed });
      cursor = end;
      if (place) { prevPlace = place; lastWasMove = false; }
      else if (s.kind === 'move') lastWasMove = true;
    });
    const cost = rows.reduce((a, r) => a + (r.place ? familyCost(r.place) : 0), 0);
    const foodCost = rows.reduce((a, r) => a + (r.place && r.place.type === 'food' ? familyCost(r.place) : 0), 0);
    return { rows, cost, foodCost, start: rows[0]?.start, end: rows.length ? rows[rows.length - 1].end : null, nPlaces: rows.filter(r => r.place && r.place.type !== 'stay').length };
  }

  /* ---------- 예산 계산 ---------- */
  const MEALS = { d0: ['d'], d1: ['b', 'l', 'd'], d2: ['b', 'l', 'd'], d3: ['b', 'l', 'd'], d4: ['b', 'l'] };
  const mealOf = m => m < 630 ? 'b' : m < 1020 ? 'l' : 'd';
  const SCEN = {
    save: { label: '절약', entry: .85, food: .85, meal: .8, snacks: .5, stay: 'min' },
    base: { label: '기본', entry: 1, food: 1, meal: 1, snacks: 1, stay: 'est' },
    comfy: { label: '여유', entry: 1.1, food: 1.3, meal: 1.2, snacks: 1.5, stay: 'max' }
  };
  const HOME_KM = 160; // 대전 ↔ 서울 편도(고속도로 기준)
  function computeBudget(slotsByDay, startByDay, stayId, B) {
    const stay = byId[stayId];
    const days = T.meta.days.map(d => {
      const c = computeDay(slotsByDay[d.id] || [], d, startByDay[d.id] || d.start);
      const ent = { a: 0, t: 0, c: 0 }, mealsHit = new Set(); let food = 0, km = 0, prev = null, n = 0;
      c.rows.forEach(r => {
        const pl = r.place; if (!pl) return;
        if (pl.type === 'food') { food += familyCost(pl); mealsHit.add(mealOf(r.start)); }
        else if (pl.type !== 'stay') { ent.a += pl.cost.a * 2; ent.t += pl.cost.t; ent.c += pl.cost.c * 2; n++; }
        if (prev && prev !== pl) km += travelEst(prev, pl).km * 1.3; prev = pl;
      });
      const missing = (MEALS[d.id] || []).filter(m => !mealsHit.has(m));
      const missingCost = missing.reduce((a, m) => a + ({ b: B.mealB, l: B.mealL, d: B.mealD }[m] || 0) * 5, 0);
      return { day: d, n, entry: ent.a + ent.t + ent.c, ent, food, mealsAssigned: mealsHit.size, missing, missingCost, km };
    });
    const sum = k => days.reduce((a, x) => a + x[k], 0);
    const kmTotal = HOME_KM * 2 + sum('km') + Number(B.extraKm || 0);
    const fuel = kmTotal / Math.max(1, Number(B.fuelEff)) * Number(B.fuelPrice);
    const nights = Number(B.nights) || 4;
    const stayRate = { min: stay?.stay?.nightly?.[0], est: stay?.stay?.nightlyEst, max: stay?.stay?.nightly?.[1] };
    const scen = {};
    Object.entries(SCEN).forEach(([k, m]) => {
      const rate = B.nightly ? Number(B.nightly) : (stayRate[m.stay] || 0);
      const rows = {
        stay: rate * nights, entry: sum('entry') * m.entry, food: sum('food') * m.food, missing: sum('missingCost') * m.meal,
        snacks: Number(B.snacks) * 5 * m.snacks, fuel, tolls: Number(B.tolls), parking: Number(B.parkingPerDay) * Number(B.parkingDays)
      };
      const subtotal = Object.values(rows).reduce((a, v) => a + v, 0);
      const reserve = subtotal * Number(B.reservePct) / 100;
      scen[k] = Object.assign(rows, { rate, subtotal, reserve, total: subtotal + reserve, perPerson: (subtotal + reserve) / 5 });
    });
    const entA = days.reduce((a, x) => a + x.ent.a, 0) / 2, entT = days.reduce((a, x) => a + x.ent.t, 0), entC = days.reduce((a, x) => a + x.ent.c, 0) / 2;
    return { days, kmTotal, nights, stay, scen, entryBreak: { a: entA, t: entT, c: entC }, mealsAssigned: sum('mealsAssigned'), mealsMissing: days.reduce((a, x) => a + x.missing.length, 0), foodTotal: sum('food'), entryTotal: sum('entry') };
  }
  const wonK = n => n >= 10000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만` : Math.round(n).toLocaleString('ko-KR');

  function renderBudget(el, slotsByDay, startByDay, stayId, editable) {
    const B = S.budget, R = computeBudget(slotsByDay, startByDay, stayId, B), cur = SCEN[B.scenario] ? B.scenario : 'base', C = R.scen[cur];
    const scenBtns = Object.entries(SCEN).map(([k, m]) => `<button data-scen="${k}" class="${k === cur ? 'on' : ''}">${m.label}</button>`).join('');
    const tiles = `<div class="budget-tiles">
      <div class="total"><b>${wonK(C.total)}원</b><span>총예산 (${SCEN[cur].label}, 예비비 포함)</span></div>
      <div><b>${wonK(C.perPerson)}원</b><span>1인당</span></div>
      <div><b>${wonK(C.stay)}원</b><span>숙박 ${R.nights}박</span></div>
      <div><b>${wonK(C.entry)}원</b><span>입장·체험·공연</span></div>
      <div><b>${wonK(C.food + C.missing + C.snacks)}원</b><span>식비·간식</span></div>
      <div><b>${wonK(C.fuel + C.tolls + C.parking)}원</b><span>연료·톨·주차</span></div></div>`;
    const cell = (k, v) => `<td class="${k === cur ? 'on' : ''}">${won(Math.round(v))}</td>`;
    const row = (label, key, note) => `<tr><td>${label}${note ? `<span class="sub-note">${note}</span>` : ''}</td>${Object.keys(SCEN).map(k => cell(k, R.scen[k][key])).join('')}</tr>`;
    const stayName = R.stay ? esc(R.stay.name.replace(/\s*\(.*$/, '').slice(0, 14)) : '숙소 미선택';
    const table = `<div class="table-wrap"><table class="budget-table"><thead><tr><th>항목</th>${Object.entries(SCEN).map(([k, m]) => `<th class="${k === cur ? 'on' : ''}">${m.label}</th>`).join('')}</tr></thead><tbody>
      ${row(`숙박 ${R.nights}박 · ${stayName}`, 'stay', B.nightly ? `1박 ${won(Number(B.nightly))} (직접 입력)` : `1박 ${won(R.scen.save.rate)} ~ ${won(R.scen.comfy.rate)} 추정`)}
      ${row('입장 · 체험 · 공연', 'entry', `성인 1인 ${won(R.entryBreak.a)} · 청소년 ${won(R.entryBreak.t)} · 어린이 1인 ${won(R.entryBreak.c)} · 절약=할인권, 여유=패스트패스 등`)}
      ${row(`식비 — 일정에 넣은 맛집 ${R.mealsAssigned}끼`, 'food', '카드 요금 × 5인')}
      ${row(`식비 — 아직 안 정한 끼니 ${R.mealsMissing}끼`, 'missing', `아침 ${won(B.mealB)} · 점심 ${won(B.mealL)} · 저녁 ${won(B.mealD)} × 5인 (설정에서 변경)`)}
      ${row('간식 · 카페 · 기념품', 'snacks', `1일 ${won(B.snacks)} × 5일`)}
      ${row(`연료 — 약 ${Math.round(R.kmTotal)}km`, 'fuel', `대전↔서울 ${HOME_KM * 2}km + 일정 내 이동 ${Math.round(R.kmTotal - HOME_KM * 2 - Number(B.extraKm || 0))}km${B.extraKm ? ` + 추가 ${B.extraKm}km` : ''} · 연비 ${B.fuelEff}km/L · ${won(B.fuelPrice)}/L`)}
      ${row('톨게이트 (왕복)', 'tolls', '')}
      ${row(`주차 ${B.parkingDays}일`, 'parking', `1일 ${won(B.parkingPerDay)} · 숙소 무료주차면 도심 공영주차 기준`)}
      <tr class="sub"><td>소계</td>${Object.keys(SCEN).map(k => cell(k, R.scen[k].subtotal)).join('')}</tr>
      ${row(`예비비 ${B.reservePct}%`, 'reserve', '')}
      <tr class="total"><td>총예산</td>${Object.keys(SCEN).map(k => cell(k, R.scen[k].total)).join('')}</tr>
      <tr><td>1인당</td>${Object.keys(SCEN).map(k => cell(k, R.scen[k].perPerson)).join('')}</tr>
    </tbody></table></div>`;
    const maxDay = Math.max(1, ...R.days.map(d => d.entry + d.food + d.missingCost));
    const MEAL_KO = { b: '아침', l: '점심', d: '저녁' };
    const dayTable = `<details class="bset"><summary>일자별 내역 (기본 시나리오)</summary><div class="table-wrap"><table class="budget-table"><thead><tr><th>일자</th><th>장소</th><th>입장·체험</th><th>맛집(배정)</th><th>미정 끼니</th><th>이동</th><th>합계</th></tr></thead><tbody>
      ${R.days.map(d => { const tot = d.entry + d.food + d.missingCost; return `<tr><td>${d.day.label}</td><td>${d.n}곳</td><td>${won(d.entry)}</td><td>${won(d.food)}<span class="sub-note">${d.mealsAssigned}끼</span></td><td>${won(d.missingCost)}<span class="sub-note">${d.missing.map(m => MEAL_KO[m]).join('·') || '없음'}</span></td><td>${Math.round(d.km)}km</td><td><b>${won(tot)}</b><i class="bar" style="width:${Math.round(tot / maxDay * 60)}px"></i></td></tr>`; }).join('')}
    </tbody></table></div></details>`;
    const stays = T.places.filter(p => p.type === 'stay');
    const settings = editable ? `<details class="bset"><summary>설정 — 숙소 · 단가 · 차량</summary><div class="bset-grid">
      <label class="wide">숙소 (장소 풀 → 숙소 탭에서 비교) <select data-b="stayId">${stays.map(p => `<option value="${p.id}" ${p.id === B.stayId ? 'selected' : ''}>${esc(p.name)} — 1박 약 ${wonK(p.stay?.nightlyEst || 0)}</option>`).join('')}</select></label>
      <label>1박 요금 직접 입력 (비우면 추정치) <input type="number" step="10000" min="0" data-b="nightly" value="${esc(B.nightly)}" placeholder="${R.stay?.stay?.nightlyEst || ''}"></label>
      <label>박수 <input type="number" min="0" max="10" data-b="nights" value="${B.nights}"></label>
      <label>주차 1일 (원) <input type="number" step="1000" min="0" data-b="parkingPerDay" value="${B.parkingPerDay}"></label>
      <label>주차 일수 <input type="number" min="0" max="5" data-b="parkingDays" value="${B.parkingDays}"></label>
      <label>연비 (km/L) <input type="number" step="0.5" min="1" data-b="fuelEff" value="${B.fuelEff}"></label>
      <label>유가 (원/L) <input type="number" step="10" min="0" data-b="fuelPrice" value="${B.fuelPrice}"></label>
      <label>추가 주행 (km) <input type="number" step="10" min="0" data-b="extraKm" value="${B.extraKm}"></label>
      <label>톨게이트 왕복 (원) <input type="number" step="1000" min="0" data-b="tolls" value="${B.tolls}"></label>
      <label>아침 1인 (원) <input type="number" step="1000" min="0" data-b="mealB" value="${B.mealB}"></label>
      <label>점심 1인 (원) <input type="number" step="1000" min="0" data-b="mealL" value="${B.mealL}"></label>
      <label>저녁 1인 (원) <input type="number" step="1000" min="0" data-b="mealD" value="${B.mealD}"></label>
      <label>간식·기타 1일 (원) <input type="number" step="5000" min="0" data-b="snacks" value="${B.snacks}"></label>
      <label>예비비 (%) <input type="number" min="0" max="50" data-b="reservePct" value="${B.reservePct}"></label>
    </div><p class="budget-note">요금은 2026년 9월 조사 기준 추정치입니다. 숙소 1박은 예약 사이트 실제 가격을 입력하면 정확해집니다. 레지던스(주방)를 고르면 아침 단가를 3,000원 수준으로 낮춰도 됩니다.</p></details>` : '';
    el.innerHTML = `<div class="budget-head"><h2>💰 예산 계산기</h2><div class="scen">${scenBtns}</div></div>${tiles}${table}${dayTable}${settings}`;
  }

  const typeChip = p => { const t = typeById[p.type]; return `<span class="chip type" style="background:${t.color}">${t.emoji} ${t.label}</span>`; };
  const statusChip = p => p.status === 'ok' ? `<span class="chip ok">운영 확인</span>` : `<span class="chip verify" title="${esc(p.verifyNote || '')}">확인 필요</span>`;
  const stars = n => `<span class="stars">${'★'.repeat(n)}<span>${'★'.repeat(3 - n)}</span></span>`;

  function renderTimeline(slots, day, startTime, editable) {
    const c = computeDay(slots, day, startTime);
    if (!c.rows.length) return `<div class="timeline"><div class="empty">아직 슬롯이 없습니다. ${editable ? '아래 "장소 추가"로 시작하거나, 추천 일정에서 복사해 오세요.' : ''}</div></div>`;
    let html = '<div class="timeline">';
    c.rows.forEach(r => {
      const s = r.slot, p = r.place;
      if (r.travel) {
        const slackTxt = r.fixed ? (r.slack < -10 ? `<span class="tight">⚠️ ${-r.slack}분 빠듯</span>` : r.slack > 15 ? `<span class="slack">여유 ${r.slack}분</span>` : '') : '';
        html += `<div class="travel">${r.travel.mode} 약 ${r.travel.min}분 <span class="muted">(${r.travel.km.toFixed(1)}km 추정)</span> · <a href="${r.travel.link}" target="_blank" rel="noopener">카카오맵 길찾기 ↗</a> ${slackTxt}</div>`;
      } else if (r.fixed && r.slack < -10 && r.i > 0) {
        html += `<div class="travel"><span class="tight">⚠️ 이전 슬롯 종료(${fmtT(r.arrival)})보다 ${-r.slack}분 이른 시작</span></div>`;
      }
      const kind = p ? `kind-place type-${p.type}` : `kind-${s.kind || 'custom'}`;
      const name = p ? `<button class="link" data-open="${p.id}">${esc(p.name)}</button>` : esc(s.title || '자유 슬롯');
      const grip = editable ? `<span class="grip" title="끌어서 순서 변경" draggable="true" data-grip="${r.i}">⋮⋮</span>` : '';
      const chips = p ? `${typeChip(p)}${p.reserve === 'required' ? '<span class="chip">예약 필수</span>' : ''}${p.status !== 'ok' ? statusChip(p) : ''}` : (s.kind === 'move' ? '<span class="chip">이동</span>' : s.kind === 'rest' ? '<span class="chip">휴식</span>' : '');
      const warns = r.warns.map(w => `<span class="chip ${w.k}">⚠️ ${esc(w.t)}</span>`).join('');
      let edit = '';
      if (editable) {
        edit = `<div class="edit" data-i="${r.i}">
          <button data-act="up" title="위로">↑</button><button data-act="down" title="아래로">↓</button>
          <label>소요 <input type="number" min="0" step="5" value="${r.dur}" data-field="dur"> 분</label>
          <label><input type="checkbox" data-field="fixedOn" ${s.fixed ? 'checked' : ''}> 고정 시각</label>
          ${s.fixed ? `<input type="time" value="${s.fixed}" data-field="fixed">` : ''}
          ${!p ? `<input type="text" value="${esc(s.title || '')}" placeholder="슬롯 이름" data-field="title">` : ''}
          <input type="text" value="${esc(s.act || '')}" placeholder="활동 메모" data-field="act">
          <button data-act="del" class="del">삭제</button>
        </div>
        <textarea class="note-edit" data-i="${r.i}" data-field="note" placeholder="비고 (참고사항)">${esc(s.note || '')}</textarea>`;
      }
      html += `<div class="slot ${kind}" data-slot="${r.i}" ${p ? `style="--tc:${typeById[p.type].color}"` : ''}>
        <div class="time">${fmtT(r.start)}<small>~ ${fmtT(r.end)}</small><small>${r.dur}분</small></div>
        <div class="body">
          <div class="name">${grip}${name}${chips}</div>
          ${s.act ? `<div class="act">${esc(s.act)}</div>` : ''}
          ${p ? `<div class="pcard-meta"><span>📍 ${esc(regionById[p.region]?.label || '')}</span><span>💰 5인 ${won(familyCost(p))}</span><span>🕒 ${esc(p.hours)}</span></div>` : ''}
          ${warns ? `<div class="warns">${warns}</div>` : ''}
          ${edit}
        </div>
        ${!editable ? `<div class="note">${s.note ? esc(s.note) : (p && p.tips ? '<b>TIP</b> ' + esc(p.tips) : '')}</div>` : ''}
      </div>`;
    });
    html += `<div class="day-foot"><span>⏱ ${fmtT(c.start)} → ${fmtT(c.end)}</span><span>📍 장소 ${c.nPlaces}곳</span><span>💰 입장·체험 ${won(c.cost - c.foodCost)}</span><span>🍜 식비 ${won(c.foodCost)}</span><span><b>합계 5인 ${won(c.cost)}</b> (숙박 제외)</span></div></div>`;
    return html;
  }

  /* ---------- 개요 ---------- */
  const PACKING = ['핫팩 (1인 하루 2개 × 4일)', '방수 장갑 · 귀마개 · 목도리 (스케이트·눈썰매·루지 필수)', '전원 신분증 (국회·민통선·청와대) — 아이는 학생증/주민등록초본', '보조배터리 2개 (지도·예매 QR)', '접이식 우산 · 미끄럼 방지 신발', '차량: 스노체인 또는 윈터타이어 점검, 워셔액 동절기용', '멀미약 (강화·파주 원정)', '예매 확인 문자·QR 캡처 폴더', '아이 각자 작은 배낭 + 간식', '가족 찜 랭킹 인쇄본 (의사결정 분쟁 해결용)'];

  function renderHome() {
    $('#stat-places').textContent = T.places.filter(p => p.type !== 'stay').length;
    $('#stat-free').textContent = T.places.filter(p => p.type !== 'stay' && familyCost(p) === 0).length;
    $('#stat-plans').textContent = PLANS.length;
    const mineN = Object.values(S.mine).reduce((a, d) => a + d.filter(s => s.p).length, 0);
    $('#stat-mine').textContent = mineN;
    const b = $('#mine-count'); b.textContent = mineN; b.hidden = !mineN;

    // 예약 캘린더
    const items = [
      { id: 'stay', when: '지금 ~ 11월', title: '숙소 예약 (5인 1실 · 주차 확인)', sub: '1순위 프레이저 플레이스 센트럴 서울 — 장소 풀 → 숙소 탭에서 10곳 비교, 4박 고정 권장' },
      { id: 'lineup', when: '10~11월', title: '겨울방학 공연 라인업 확인 → 공연 1~2개 예매', sub: '세종문화회관 · 샤롯데씨어터 · 국립극장 · 예술의전당' },
      { id: 'nanta', when: '11~12월', title: '난타 / 페인터즈 2027.1 일정 확인 후 예매', sub: '현재 확정 기간이 2026년 말까지라 연장 공지 확인' },
      { id: 'season', when: '12월 초', title: '서울광장 스케이트장 · 뚝섬 눈썰매장 · 빛초롱축제 26-27 시즌 일정 확인', sub: '' },
      { id: 'assembly', when: '10/22 이후 (90일 전)', title: '국회 참관 예약 (1/21 목 10:00 회차 등)', sub: '전원 신분증. 1/23(토)는 미운영' },
      { id: 'nmk', when: '1/6 0시 (14일 전)', title: '★ 국립중앙박물관 어린이박물관 회차 예약 (1/20 수)', sub: '1인 최대 5매 — 딱 5인. 오픈 즉시' },
      { id: 'kbs', when: '1/14까지 (5일 전)', title: 'KBS On 견학 예약', sub: '' },
      { id: 'sky', when: '1/15 전후', title: '서울스카이 · 코엑스 아쿠아리움 온라인 할인권', sub: '날씨 보고 서울스카이 날짜 확정' },
      { id: 'kids', when: '방문 2주 전', title: '어린이박물관류(전쟁기념관·민속박물관·세계문자박물관) 회차 예약', sub: '' },
      { id: 'weather', when: '1/17~18', title: '주간 예보 확인 → 원정일(D2)·야외 슬롯 최종 확정', sub: '한파면 플랜 B 실내형으로 전환' }
    ];
    $('#booking-list').innerHTML = items.map(it => `<li><input type="checkbox" data-check="b_${it.id}" ${S.checks['b_' + it.id] ? 'checked' : ''}><div class="${S.checks['b_' + it.id] ? 'done' : ''}"><span class="when">${esc(it.when)}</span>${esc(it.title)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}</div></li>`).join('');
    $('#packing-list').innerHTML = PACKING.map((t, i) => `<li><input type="checkbox" data-check="p_${i}" ${S.checks['p_' + i] ? 'checked' : ''}><div class="${S.checks['p_' + i] ? 'done' : ''}">${esc(t)}</div></li>`).join('');

    // 가족 이름
    $('#members-edit').innerHTML = T.members.map(m => `<input type="text" value="${esc(memberName(m))}" data-member="${m.id}" aria-label="가족 이름">`).join('');
    renderSyncCard();

    // 랭킹
    const ranked = T.places.filter(p => voteCount(p.id) > 0).sort((a, b) => voteCount(b.id) - voteCount(a.id) || a.name.localeCompare(b.name)).slice(0, 12);
    const me = S.sync.me, myCount = me ? T.places.filter(p => votedBy(p.id).includes(me)).length : 0, allCount = T.places.filter(p => voteCount(p.id) > 0).length;
    $('#rank-stats').textContent = allCount ? `가족 전체 ${allCount}곳${me ? ` · 내 찜 ${myCount}곳` : ''} · 많이 찜한 순` : '';
    $('#vote-ranking').innerHTML = ranked.length ? ranked.map(p => { const mine = me && votedBy(p.id).includes(me); return `<li class="${mine ? 'mine' : ''}"><button data-open="${p.id}">${esc(p.name)}</button>${mine ? '<span class="me-tag">나</span>' : ''}<span class="hearts">${votedBy(p.id).map(mid => { const m = T.members.find(x => x.id === mid); return m ? `<span title="${esc(memberName(m))}">${m.emoji}</span>` : '❤️'; }).join(' ')} · ${voteCount(p.id)}표</span></li>`; }).join('') : '<li class="muted">아직 찜한 장소가 없습니다. 장소 카드의 ♡ 를 누르거나 카드를 열어 찜해보세요.</li>';
  }
  $('#view-home').addEventListener('change', e => {
    if (e.target.dataset.check) { S.checks[e.target.dataset.check] = e.target.checked; save(); renderHome(); }
    if (e.target.dataset.member) { const mid = e.target.dataset.member; S.mem[mid] = { name: e.target.value.trim() || T.members.find(m => m.id === mid).name, ts: Date.now() }; save(); SYNC.markDirty(`mem/${mid}`); renderHome(); }
  });

  /* ---------- 장소 풀 ---------- */
  const inType = (p, t) => !t || p.type === t || (p.types || []).includes(t);
  function poolList(q, type, filters, region, sort) {
    let list = T.places.filter(p => inType(p, type) && matches(p, q) && (!region || p.region === region));
    if (filters.free) list = list.filter(p => familyCost(p) === 0);
    if (filters.indoor) list = list.filter(p => p.indoor === true);
    if (filters.reserve) list = list.filter(p => p.reserve === 'required');
    if (filters.ok) list = list.filter(p => p.status === 'ok');
    if (filters.k3) list = list.filter(p => p.ages.k3 >= 3);
    if (filters.k1) list = list.filter(p => p.ages.k1 >= 3);
    if (filters.voted) list = list.filter(p => voteCount(p.id) > 0);
    if (filters.mine) list = list.filter(p => S.sync.me && votedBy(p.id).includes(S.sync.me));
    const typeOrder = Object.fromEntries(T.types.map((t, i) => [t.id, i]));
    const score = p => (p.type === 'must' ? 100 : 0) + p.ages.k1 + p.ages.k2 + p.ages.k3;
    const sorters = {
      rec: (a, b) => typeOrder[a.type] - typeOrder[b.type] || score(b) - score(a) || a.name.localeCompare(b.name),
      votes: (a, b) => voteCount(b.id) - voteCount(a.id) || score(b) - score(a),
      cost: (a, b) => familyCost(a) - familyCost(b) || score(b) - score(a),
      dur: (a, b) => a.dur - b.dur,
      name: (a, b) => a.name.localeCompare(b.name, 'ko')
    };
    return list.sort(sorters[sort] || sorters.rec);
  }
  function cardHTML(p) {
    const t = typeById[p.type];
    const me = S.sync.me, myOn = me && votedBy(p.id).includes(me), likers = likersOf(p.id);
    const qh = me ? `<button class="qheart ${myOn ? 'on' : ''}" data-qvote="${p.id}" aria-label="내 찜" title="내 찜">${myOn ? '❤️' : '♡'}</button>` : (S.sync.url ? `<button class="qheart" data-pickme aria-label="찜하려면 내 이름 선택" title="찜하려면 내 이름 선택">♡</button>` : '');
    return `<article class="pcard" style="--tc:${t.color}" data-open="${p.id}" tabindex="0" role="button">${qh}
      <div class="pcard-top"><div><h3>${esc(p.name)}</h3><div class="region">📍 ${esc(regionById[p.region]?.label || '')} · ${p.dur ? p.dur + '분' : '숙박'}</div></div>${statusChip(p)}</div>
      <p class="why">${esc(p.why)}</p>
      <div class="age-row"><span>중2 ${stars(p.ages.k1)}</span><span>초6 ${stars(p.ages.k2)}</span><span>초3 ${stars(p.ages.k3)}</span></div>
      ${planIdsOf[p.id] ? `<div class="inplans">추천안 <b>${[...planIdsOf[p.id]].join(' · ')}</b>에 포함</div>` : ''}
      <div class="pcard-foot"><div class="chips">${typeChip(p)}${familyCost(p) === 0 && p.type !== 'stay' ? '<span class="chip free">무료</span>' : `<span class="chip">5인 ${won(familyCost(p))}</span>`}${p.reserve === 'required' ? '<span class="chip">예약</span>' : ''}${p.indoor === true ? '<span class="chip">실내</span>' : ''}</div>${likers.length ? `<span class="hearts-mini" title="${esc(likers.map(m => memberName(m)).join(', '))}"><span class="likers-mini">${likers.map(m => m.emoji).join('')}</span> ${likers.length}</span>` : ''}</div>
    </article>`;
  }
  function renderPool() {
    const counts = Object.fromEntries(T.types.map(t => [t.id, T.places.filter(p => inType(p, t.id)).length]));
    $('#type-tabs').innerHTML = [`<button data-type="" class="${!S.poolType ? 'on' : ''}">전체 <b>${T.places.length}</b></button>`]
      .concat(T.types.map(t => `<button data-type="${t.id}" class="${S.poolType === t.id ? 'on' : ''}">${t.emoji} ${t.label} <b>${counts[t.id]}</b></button>`)).join('');
    const rs = $('#pool-region'); if (rs.options.length === 1) T.regions.forEach(r => rs.add(new Option(r.label, r.id)));
    rs.value = S.poolRegion; $('#pool-sort').value = S.poolSort;
    $$('#pool-filters button[data-f]').forEach(b => b.classList.toggle('on', !!S.poolFilters[b.dataset.f]));
    $('#pool-clear').hidden = !(Object.values(S.poolFilters).some(Boolean) || S.poolRegion || S.poolType || $('#pool-q').value);
    const list = poolList($('#pool-q').value, S.poolType, S.poolFilters, S.poolRegion, S.poolSort);
    $('#pool-count').textContent = `${list.length}개 표시 · 5인 비용은 성인2·청소년1·어린이2 기준 추정`;
    $('#pool-cards').innerHTML = list.map(cardHTML).join('') || '<p class="empty">조건에 맞는 장소가 없습니다.</p>';
    const st = $('#stay-table');
    if (S.poolType === 'stay') {
      const stays = T.places.filter(p => p.type === 'stay');
      const nights = Number(S.budget.nights) || 4;
      st.innerHTML = `<div class="stay-wrap"><table class="stay-table"><thead><tr><th>숙소</th><th>권역</th><th>객실 · 인원</th><th>주방/세탁</th><th>수영장 등</th><th>주차</th><th>1박 추정</th><th>${nights}박</th><th>추천안</th><th>계산기</th></tr></thead><tbody>
        ${stays.map(p => { const x = p.stay || {}; const sel = p.id === S.budget.stayId; return `<tr class="${sel ? 'sel' : ''}"><td class="name"><button class="link-btn" data-open="${p.id}">${esc(p.name)}</button>${p.tags?.includes('1순위') ? ' <span class="chip">1순위</span>' : ''}</td><td>${esc(regionById[p.region]?.label || '')}</td><td>${esc(x.room || '')}<span class="sub-note" style="display:block;color:var(--muted);font-size:.74rem">${esc(x.maxGuests || '')}</span></td><td>${x.kitchen === true ? '주방 ○' : x.kitchen ? '주방 ' + esc(x.kitchen) : '주방 ×'} / ${x.laundry ? '세탁 ○' : '세탁 ×'}</td><td>${esc(x.pool || '—')}</td><td>${esc(x.parking || '')}</td><td class="num">${x.nightly ? `${wonK(x.nightly[0])}~${wonK(x.nightly[1])}` : '—'}</td><td class="num"><b>${wonK((x.nightlyEst || 0) * nights)}</b></td><td>${(x.bestFor || []).join(' · ')}</td><td><button data-pickstay="${p.id}" class="${sel ? 'on' : ''}">${sel ? '선택됨' : '선택'}</button></td></tr>`; }).join('')}
      </tbody></table></div><p class="muted small">요금은 2026.9 조사 기준 1박 추정 범위이며 성수기·요일에 따라 다릅니다. "선택"을 누르면 내 일정의 예산 계산기에 반영됩니다. 5인 1실 가능 여부는 모두 예약 전 확인이 필요합니다.</p>`;
    } else st.innerHTML = '';
  }
  $('#type-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.poolType = b.dataset.type; save(); renderPool(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-pickstay]'); if (!b) return; S.budget.stayId = b.dataset.pickstay; S.budget.nightly = ''; save(); renderPool(); renderMine(); renderPlans(); toast(`예산 계산기 숙소: ${byId[b.dataset.pickstay].name}`); if ($('#modal').hidden === false) closeModals(); });
  $('#pool-filters').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'pool-clear') { S.poolFilters = {}; S.poolRegion = ''; S.poolType = ''; $('#pool-q').value = ''; save(); renderPool(); return; } S.poolFilters[b.dataset.f] = !S.poolFilters[b.dataset.f]; save(); renderPool(); });
  $('#pool-q').addEventListener('input', renderPool);
  $('#pool-region').addEventListener('change', e => { S.poolRegion = e.target.value; save(); renderPool(); });
  $('#pool-sort').addEventListener('change', e => { S.poolSort = e.target.value; save(); renderPool(); });

  /* ---------- 상세 모달 ---------- */
  const likersOf = pid => votedBy(pid).map(mid => T.members.find(m => m.id === mid)).filter(Boolean);
  function voteRowHTML(pid) {
    const me = S.sync.me, meM = T.members.find(m => m.id === me), likers = likersOf(pid);
    const likersHtml = `<span class="likers">${likers.length ? '가족 찜 · ' + likers.map(m => `<span class="${m.id === me ? 'me' : ''}">${m.emoji} ${esc(memberName(m))}</span>`).join(' ') : '아직 찜한 가족이 없어요'}</span>`;
    if (meM) { const on = votedBy(pid).includes(me); return `<div class="vote-row"><button class="vote-me ${on ? 'on' : ''}" data-vote="${me}">${on ? '❤️ 찜했어요' : '♡ 찜하기'}<small>${meM.emoji} ${esc(memberName(meM))}</small></button>${likersHtml}</div>`; }
    if (S.sync.url) return `<div class="vote-row"><button class="vote-me ask" data-pickme>♡ 찜하기 — 먼저 내가 누구인지 골라주세요</button>${likersHtml}</div>`;
    return `<div class="vote-row">${T.members.map(m => { const on = votedBy(pid).includes(m.id); return `<button data-vote="${m.id}" class="${on ? 'on' : ''}">${m.emoji} ${esc(memberName(m))} ${on ? '❤️' : '♡'}</button>`; }).join('')}<span class="vote-hint">한 기기에서 함께 쓰는 중 — 가족방을 만들면 각자 폰에서 자기 이름으로만 찜합니다</span></div>`;
  }
  function openDetail(pid) {
    const p = byId[pid]; if (!p) return;
    const inPlans = PLANS.filter(pl => Object.values(pl.days).some(d => d.some(s => s.p === pid))).map(pl => pl.id);
    const ages = `중2 ${stars(p.ages.k1)} &nbsp; 초6 ${stars(p.ages.k2)} &nbsp; 초3 ${stars(p.ages.k3)}`;
    $('#modal-card').innerHTML = `<div class="detail">
      <div class="modal-head"><div><h2>${esc(p.name)}</h2><div class="sub">📍 ${esc(regionById[p.region]?.label || '')} · ${typeChip(p)} ${statusChip(p)}</div></div><button class="icon-btn" data-close aria-label="닫기">✕</button></div>
      ${p.status !== 'ok' && p.verifyNote ? `<p class="small" style="color:var(--verify)">⚠️ ${esc(p.verifyNote)}</p>` : ''}
      <div class="why">💡 <b>왜 여기?</b> ${esc(p.why)}</div>
      <dl>
        <dt>소요</dt><dd>${p.dur ? '약 ' + p.dur + '분' : '—'}</dd>
        <dt>요금</dt><dd><b>5인 ${won(familyCost(p))}</b>${p.cost?.note ? ` · ${esc(p.cost.note)}` : ''}</dd>
        <dt>운영</dt><dd>${esc(p.hours)}</dd>
        <dt>휴무</dt><dd>${esc(p.closed)}</dd>
        <dt>예약</dt><dd>${p.reserve === 'required' ? '<b>필수</b>' : p.reserve === 'recommended' ? '권장' : '불필요'}${p.reserveNote && p.reserveNote !== '—' ? ` · ${esc(p.reserveNote)}` : ''}</dd>
        <dt>실내/외</dt><dd>${p.indoor === true ? '실내' : p.indoor === false ? '야외' : '실내+야외'}</dd>
        <dt>주차</dt><dd>${esc(p.parking)}</dd>
        <dt>추천도</dt><dd>${ages}</dd>
        ${inPlans.length ? `<dt>추천안</dt><dd>${inPlans.map(id => `<span class="chip">${id}안</span>`).join(' ')}</dd>` : ''}
      </dl>
      ${p.stay ? `<div class="stay-box"><b>🏨 객실</b> ${esc(p.stay.room)} · <b>인원</b> ${esc(p.stay.maxGuests)}<br><b>시설</b> ${p.stay.kitchen === true ? '주방 ○' : p.stay.kitchen ? '주방 ' + esc(p.stay.kitchen) : '주방 ×'} · ${p.stay.laundry ? '세탁 ○' : '세탁 ×'} · ${esc(p.stay.pool || '')}<br><b>1박 추정</b> ${won(p.stay.nightly[0])} ~ ${won(p.stay.nightly[1])} (계산기 기본 ${won(p.stay.nightlyEst)}) · <b>${Number(S.budget.nights) || 4}박</b> 약 ${won(p.stay.nightlyEst * (Number(S.budget.nights) || 4))}<div class="pc"><div><b>👍 장점</b><ul>${p.stay.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>👎 단점</b><ul>${p.stay.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div><div style="margin-top:8px"><button class="btn small ${S.budget.stayId === p.id ? 'primary' : ''}" data-pickstay="${p.id}">${S.budget.stayId === p.id ? '✓ 예산 계산기 숙소로 선택됨' : '💰 예산 계산기 숙소로 선택'}</button></div></div>` : ''}
      ${p.tips ? `<div class="tips"><b>비고</b> · ${esc(p.tips)}</div>` : ''}
      <div class="links">
        ${p.links?.official ? `<a class="btn small" href="${p.links.official}" target="_blank" rel="noopener">🔗 공식</a>` : ''}
        ${p.links?.booking ? `<a class="btn small" href="${p.links.booking}" target="_blank" rel="noopener">🎟️ 예약·예매</a>` : ''}
        <a class="btn small" href="https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(p.name.replace(/\s*\(.*$/, ''))}" target="_blank" rel="noopener">📷 사진 보기</a>
        <a class="btn small" href="${naverSearch(p)}" target="_blank" rel="noopener">🟢 네이버지도</a>
        <a class="btn small" href="${kakaoSearch(p)}" target="_blank" rel="noopener">🟡 카카오맵</a>
        <a class="btn small" href="${kakaoTo(p)}" target="_blank" rel="noopener">🚗 길찾기</a>
        <a class="btn small" href="#map/${p.id}" data-close>🗺️ 지도에서</a>
      </div>
      ${voteRowHTML(pid)}
      <div class="add-row"><span class="small muted">내 일정에 담기 →</span><select id="detail-day">${T.meta.days.map(d => `<option value="${d.id}" ${d.id === S.mineDay ? 'selected' : ''}>${d.label}</option>`).join('')}</select><button class="btn primary small" data-add="${pid}">＋ 추가</button></div>
      <div class="modal-foot"><button class="btn small" data-close>닫기</button></div>
    </div>`;
    showOverlay('#modal');
    $('#modal-card').dataset.pid = pid;
  }
  const OVERLAYS = ['#modal', '#picker', '#links', '#who'];
  function showOverlay(sel) { const el = $(sel); if (!el || !el.hidden) return; el.hidden = false; document.body.style.overflow = 'hidden'; try { history.pushState({ overlay: sel }, ''); } catch (e) { /* ignore */ } }
  function hideOverlays(fromHistory) {
    let any = false; OVERLAYS.forEach(sel => { const el = $(sel); if (el && !el.hidden) { el.hidden = true; any = true; } });
    document.body.style.overflow = '';
    if (any && !fromHistory && history.state && history.state.overlay) { try { history.back(); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('popstate', () => hideOverlays(true));
  function closeModals(fromHistory) { hideOverlays(!!fromHistory); }
  document.addEventListener('click', e => {
    const cl = e.target.closest('[data-close]'); if (cl) { closeModals(cl.tagName === 'A' && cl.getAttribute('href')); return; }
    const q = e.target.closest('[data-qvote]'); if (q) { e.preventDefault(); const pid = q.dataset.qvote, me = S.sync.me; if (!me) { openWho(true); return; } setVote(pid, me, !votedBy(pid).includes(me)); renderPool(); renderHome(); return; }
    if (e.target.closest('[data-pickme]')) { openWho(true); return; }
    const o = e.target.closest('[data-open]'); if (o) { openDetail(o.dataset.open); return; }
    const v = e.target.closest('[data-vote]'); if (v) {
      const pid = $('#modal-card').dataset.pid, mid = v.dataset.vote;
      if (S.sync.me && mid !== S.sync.me) { toast('내 이름으로만 찜할 수 있어요'); return; }
      setVote(pid, mid, !votedBy(pid).includes(mid)); openDetail(pid); renderHome(); renderPool(); return;
    }
    const a = e.target.closest('[data-add]'); if (a) { addPlace(a.dataset.add, $('#detail-day').value); closeModals(); return; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); if (e.key === 'Enter' && e.target.classList?.contains('pcard')) openDetail(e.target.dataset.open); });

  /* ---------- 추천 일정 ---------- */
  function renderPlans() {
    const plan = PLANS.find(p => p.id === S.planId) || PLANS[0];
    $('#plan-picker').innerHTML = PLANS.map(p => {
      const cs = T.meta.days.map(d => computeDay(p.days[d.id] || [], d, d.start));
      const entry = cs.reduce((a, c) => a + c.cost - c.foodCost, 0), n = cs.reduce((a, c) => a + c.nPlaces, 0);
      const far = Object.values(p.days).some(d => d.some(sl => sl.p && ['far'].includes(byId[sl.p]?.type)));
      return `<button class="plan-btn ${p.id === plan.id ? 'on' : ''}" data-plan="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tag)}</span><i>📍 ${n}곳 · 🎟️ ${won(entry)}${far ? ' · 🚗 원정 포함' : ''}</i></button>`;
    }).join('');
    const stay = byId[plan.stay];
    const days = T.meta.days.map(d => computeDay(plan.days[d.id] || [], d, d.start));
    const total = days.reduce((a, c) => a + c.cost, 0), food = days.reduce((a, c) => a + c.foodCost, 0);
    const starts = Object.fromEntries(T.meta.days.map(d => [d.id, d.start]));
    const PB = computeBudget(plan.days, starts, plan.stay, S.budget), cur = SCEN[S.budget.scenario] ? S.budget.scenario : 'base';
    $('#plan-summary').innerHTML = `<h2>${esc(plan.name)}</h2><p class="fit">👨‍👩‍👧‍👦 이런 가족에게: ${esc(plan.fit)}</p><p>${esc(plan.summary)}</p><div class="kv"><span>🏨 숙소: <button class="link-btn" data-open="${stay.id}">${esc(stay.name)}</button></span><span>🎟️ 입장·체험·공연 5인 <b>${won(total - food)}</b></span><span>🍜 식비 추정 <b>${won(food)}</b></span><span>💡 ${esc(plan.budgetHint)}</span></div>
      <div class="kv"><span>💰 <b>예상 총예산 ${wonK(PB.scen[cur].total)}원</b> (${SCEN[cur].label} · 숙박 ${PB.nights}박 · 식비 · 연료 · 주차 · 예비비 포함 · 1인 ${wonK(PB.scen[cur].perPerson)}원)</span><span>절약 ${wonK(PB.scen.save.total)} / 기본 ${wonK(PB.scen.base.total)} / 여유 ${wonK(PB.scen.comfy.total)}</span></div>`;
    $('#plan-day-tabs').innerHTML = T.meta.days.map(d => `<button data-day="${d.id}" class="${d.id === S.planDay ? 'on' : ''}">${d.label}<small>${esc(d.hint)}</small></button>`).join('');
    $('#plan-days').innerHTML = T.meta.days.map(d => `<section class="day-panel" ${d.id === S.planDay ? '' : 'hidden'}><div class="day-head"><h2>${d.label}</h2><span class="hint">${esc(d.hint)}</span></div>${renderTimeline(plan.days[d.id] || [], d, d.start, false)}</section>`).join('');
    $('#btn-plan-map').href = `#map/plan-${plan.id}/${S.planDay}`;
  }
  $('#plan-picker').addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (!b) return; S.planId = b.dataset.plan; save(); renderPlans(); });
  $('#plan-day-tabs').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; S.planDay = b.dataset.day; save(); renderPlans(); });
  $('#btn-copy-plan').addEventListener('click', () => {
    const plan = PLANS.find(p => p.id === S.planId);
    const has = Object.values(S.mine).some(d => d.length);
    if (has && !confirm('내 일정에 이미 내용이 있습니다. 모두 지우고 이 추천안으로 바꿀까요?')) return;
    T.meta.days.forEach(d => {
      const src = plan.days[d.id] || [];
      S.mine[d.id] = src.map(s => { const p = s.p ? byId[s.p] : null; return { id: uid(), p: s.p, title: s.title, kind: s.kind, dur: s.dur != null ? s.dur : (p ? p.dur : 60), fixed: (p && p.type === 'show') ? s.t : null, act: s.act || '', note: s.note || '' }; });
      S.mineStart[d.id] = src[0]?.t || d.start;
    });
    S.mineDay = 'd1'; save(); renderMine(); renderHome(); location.hash = '#mine'; toast(`${plan.name}을(를) 내 일정으로 복사했습니다`);
  });

  /* ---------- 내 일정 ---------- */
  function addPlace(pid, dayId, opts = {}) {
    const p = byId[pid]; if (!p) return;
    S.mine[dayId].push(Object.assign({ id: uid(), p: pid, dur: p.dur || 60, fixed: null, act: '', note: '' }, opts));
    S.mineDay = dayId; save(); renderMine(); renderHome(); toast(`${dayById[dayId].label}에 "${p.name}" 추가`);
  }
  function renderMine() {
    const d = dayById[S.mineDay];
    $('#mine-day-tabs').innerHTML = T.meta.days.map(x => { const n = S.mine[x.id].filter(s => s.p).length; return `<button data-day="${x.id}" class="${x.id === S.mineDay ? 'on' : ''}">${x.label}<small>${n ? n + '곳' : '비어 있음'}</small></button>`; }).join('');
    $('#mine-days').innerHTML = T.meta.days.map(x => `<section class="day-panel" ${x.id === S.mineDay ? '' : 'hidden'}><div class="day-head"><h2>${x.label}</h2><label class="day-start">시작 시각 <input type="time" value="${S.mineStart[x.id]}" data-start="${x.id}"></label></div>${renderTimeline(S.mine[x.id], x, S.mineStart[x.id], true)}</section>`).join('');
    const tot = T.meta.days.map(x => computeDay(S.mine[x.id], x, S.mineStart[x.id]));
    const warns = tot.reduce((a, c) => a + c.rows.reduce((b, r) => b + r.warns.length + (r.fixed && r.slack < -10 ? 1 : 0), 0), 0);
    renderBudget($('#budget'), S.mine, S.mineStart, S.budget.stayId, true);
    $('#budget').insertAdjacentHTML('beforeend', `<p class="budget-note">⚠️ 충돌 경고 <b style="color:${warns ? 'var(--warn)' : 'var(--good)'}">${warns}건</b> — 각 일자의 슬롯에서 확인</p>`);
    void d;
  }
  $('#mine-day-tabs').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; S.mineDay = b.dataset.day; save(); renderMine(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-scen]'); if (!b) return; S.budget.scenario = b.dataset.scen; save(); renderMine(); renderPlans(); });
  $('#budget').addEventListener('change', e => {
    const k = e.target.dataset.b; if (!k) return;
    S.budget[k] = e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    save(); renderMine(); renderPlans(); renderPool();
  });
  $('#mine-days').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.start) { S.mineStart[t.dataset.start] = t.value || dayById[t.dataset.start].start; save(); renderMine(); return; }
    const i = Number(t.closest('[data-i]')?.dataset.i); if (Number.isNaN(i)) return;
    const s = S.mine[S.mineDay][i]; if (!s) return;
    const f = t.dataset.field;
    if (f === 'dur') s.dur = Math.max(0, Number(t.value) || 0);
    else if (f === 'fixedOn') s.fixed = t.checked ? fmtT(computeDay(S.mine[S.mineDay], dayById[S.mineDay], S.mineStart[S.mineDay]).rows[i].start) : null;
    else if (f === 'fixed') s.fixed = t.value || null;
    else if (f === 'title') s.title = t.value;
    else if (f === 'act') s.act = t.value;
    else if (f === 'note') s.note = t.value;
    save(); renderMine();
  });
  $('#mine-days').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const i = Number(b.closest('[data-i]').dataset.i), arr = S.mine[S.mineDay];
    if (b.dataset.act === 'del') arr.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (b.dataset.act === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    save(); renderMine(); renderHome();
  });
  $('#btn-add-custom').addEventListener('click', () => {
    const title = prompt('슬롯 이름 (예: 잠실 이동, 카페 휴식, 체크아웃)', '이동'); if (title == null) return;
    const dur = Number(prompt('소요 시간(분)', '30')) || 30;
    S.mine[S.mineDay].push({ id: uid(), title, kind: /이동|출발|귀가|복귀/.test(title) ? 'move' : /휴식|카페|낮잠/.test(title) ? 'rest' : 'custom', dur, fixed: null, act: '', note: '' });
    save(); renderMine();
  });
  $('#btn-reset').addEventListener('click', () => { if (!S.mine[S.mineDay].length) return; if (confirm(`${dayById[S.mineDay].label} 일정을 모두 지울까요?`)) { S.mine[S.mineDay] = []; save(); renderMine(); renderHome(); } });
  $('#btn-export').addEventListener('click', () => {
    const data = { app: 'seoul-winter-trip', version: 2, exportedAt: new Date().toISOString(), mem: S.mem, vt: S.vt, checks: S.checks, mine: S.mine, mineStart: S.mineStart, budget: S.budget };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `seoul-trip-2027-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast('JSON 파일로 내보냈습니다');
  });
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const d = JSON.parse(txt); if (d.app !== 'seoul-winter-trip') throw new Error('형식이 다릅니다');
      if (!confirm('가져온 내용으로 내 일정·찜·체크를 덮어쓸까요?')) return;
      ['checks', 'mine', 'mineStart', 'vt', 'mem'].forEach(k => { if (d[k]) S[k] = d[k]; }); if (d.votes && !d.vt) { S.vt = {}; Object.entries(d.votes).forEach(([pid, arr]) => (arr || []).forEach(mid => { (S.vt[pid] = S.vt[pid] || {})[mid] = { on: true, ts: 1 }; })); } if (d.members && !d.mem) { S.mem = {}; Object.entries(d.members).forEach(([mid, name]) => { S.mem[mid] = { name, ts: 1 }; }); } if (d.budget) S.budget = Object.assign(defaults().budget, d.budget); SYNC.markAllDirty(); SYNC.schedulePush();
      T.meta.days.forEach(x => { S.mine[x.id] = S.mine[x.id] || []; S.mineStart[x.id] = S.mineStart[x.id] || x.start; });
      save(); renderAll(); toast('가져오기 완료');
    }).catch(err => alert('가져오기 실패: ' + err.message)).finally(() => { e.target.value = ''; });
  });

  // 장소 선택 모달
  let pickerDay = null;
  function openPicker() {
    pickerDay = S.mineDay;
    const ts = $('#picker-type'); if (ts.options.length === 1) T.types.forEach(t => ts.add(new Option(`${t.emoji} ${t.label}`, t.id)));
    showOverlay('#picker'); renderPicker(); setTimeout(() => $('#picker-q').focus(), 50);
  }
  function renderPicker() {
    const list = poolList($('#picker-q').value, $('#picker-type').value, {}, '', 'rec');
    $('#picker-list').innerHTML = `<div class="picker-days">${T.meta.days.map(d => `<button data-pday="${d.id}" class="${d.id === pickerDay ? 'on' : ''}">${d.label}</button>`).join('')}</div>` +
      list.map(p => `<button data-pick="${p.id}"><span class="dot" style="background:${typeById[p.type].color}"></span><span>${esc(p.name)}</span><small>${esc(regionById[p.region]?.label || '')} · ${p.dur ? p.dur + '분' : ''} · ${won(familyCost(p))}</small></button>`).join('');
  }
  $('#btn-add-place').addEventListener('click', openPicker);
  $('#picker-q').addEventListener('input', renderPicker);
  $('#picker-type').addEventListener('change', renderPicker);
  $('#picker-list').addEventListener('click', e => {
    const d = e.target.closest('[data-pday]'); if (d) { pickerDay = d.dataset.pday; renderPicker(); return; }
    const b = e.target.closest('[data-pick]'); if (b) { addPlace(b.dataset.pick, pickerDay); }
  });

  // 드래그 정렬 (데스크톱 HTML5 DnD; 모바일은 ↑↓ 버튼)
  let dragFrom = null;
  $('#mine-days').addEventListener('dragstart', e => {
    const g = e.target.closest('[data-grip]'); if (!g) { e.preventDefault(); return; }
    dragFrom = Number(g.dataset.grip); g.closest('.slot').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  $('#mine-days').addEventListener('dragover', e => {
    const slot = e.target.closest('.slot[data-slot]'); if (!slot || dragFrom == null) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const rect = slot.getBoundingClientRect(); const before = (e.clientY - rect.top) < rect.height / 2;
    $$('.slot', slot.parentElement).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    slot.classList.add(before ? 'drop-before' : 'drop-after');
  });
  $('#mine-days').addEventListener('dragleave', e => { const slot = e.target.closest('.slot'); if (slot) slot.classList.remove('drop-before', 'drop-after'); });
  $('#mine-days').addEventListener('drop', e => {
    const slot = e.target.closest('.slot[data-slot]'); if (!slot || dragFrom == null) return;
    e.preventDefault();
    const to = Number(slot.dataset.slot); const rect = slot.getBoundingClientRect(); const before = (e.clientY - rect.top) < rect.height / 2;
    const arr = S.mine[S.mineDay]; if (dragFrom === to) { dragFrom = null; renderMine(); return; }
    const [item] = arr.splice(dragFrom, 1);
    let idx = to; if (dragFrom < to) idx -= 1; if (!before) idx += 1;
    arr.splice(Math.max(0, Math.min(idx, arr.length)), 0, item);
    dragFrom = null; save(); renderMine();
  });
  $('#mine-days').addEventListener('dragend', () => { dragFrom = null; $$('.slot').forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after')); });

  // 공유 링크: 내 일정 전체를 URL 해시에 압축 인코딩
  const b64e = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  function sharePayload() {
    // 슬롯을 배열로 축약: [p, title, kind, dur, fixed, act, note]
    const days = T.meta.days.map(d => S.mine[d.id].map(s => [s.p || '', s.title || '', s.kind || '', s.dur, s.fixed || '', s.act || '', s.note || '']));
    return b64e(JSON.stringify({ v: 1, st: T.meta.days.map(d => S.mineStart[d.id]), d: days, b: S.budget, r: S.sync.url ? SYNC.token() : undefined }));
  }
  function applyShare(code) {
    const o = JSON.parse(b64d(code)); if (o.v !== 1 || !Array.isArray(o.d)) throw new Error('형식 오류');
    T.meta.days.forEach((d, i) => {
      S.mine[d.id] = (o.d[i] || []).map(a => ({ id: uid(), p: a[0] || undefined, title: a[1] || undefined, kind: a[2] || undefined, dur: a[3], fixed: a[4] || null, act: a[5] || '', note: a[6] || '' })).filter(s => !s.p || byId[s.p]);
      S.mineStart[d.id] = (o.st && o.st[i]) || d.start;
    });
    if (o.b) S.budget = Object.assign(defaults().budget, o.b);
    if (o.r && !S.sync.url) { try { SYNC.join(o.r); } catch (e) { /* 무시 */ } }
    save(); renderAll();
  }
  $('#btn-share').addEventListener('click', async () => {
    const has = Object.values(S.mine).some(d => d.length); if (!has) { toast('먼저 내 일정에 슬롯을 담아주세요'); return; }
    const url = `${location.origin}${location.pathname}#mine/share=${sharePayload()}`;
    if (url.length > 8000) toast('일정이 커서 일부 앱에서 링크가 잘릴 수 있어요 — JSON 내보내기를 함께 쓰세요');
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title: '서울 겨울 가족여행 일정', url }); return; }
      await navigator.clipboard.writeText(url); toast('공유 링크를 복사했습니다 — 카톡에 붙여넣기');
    } catch (e) { prompt('아래 링크를 복사하세요', url); }
  });
  function checkShareHash() {
    const rm = location.hash.match(/room=([A-Za-z0-9\-_]+)/);
    if (rm) {
      const mm = location.hash.match(/[&/]me=(\w+)/); const mid = mm && T.members.find(m => m.id === mm[1]) ? mm[1] : '';
      try { SYNC.join(rm[1]); if (mid) { S.sync.me = mid; save(); toast(`${memberName(T.members.find(m => m.id === mid))}(으)로 시작합니다`); } } catch (e) { alert('가족 링크를 해석할 수 없습니다: ' + e.message); }
      history.replaceState(null, '', '#home'); renderHome();
    }
    const m = location.hash.match(/share=([A-Za-z0-9\-_]+)/); if (!m) return;
    const has = Object.values(S.mine).some(d => d.length);
    if (!has || confirm('공유받은 일정으로 내 일정을 바꿀까요? (현재 내용은 사라집니다)')) {
      try { applyShare(m[1]); toast('공유받은 일정을 불러왔습니다'); } catch (e) { alert('링크를 해석할 수 없습니다: ' + e.message); }
    }
    history.replaceState(null, '', '#mine');
  }

  // PWA 서비스 워커 (파일 프로토콜에서는 건너뜀)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- 지도 ---------- */
  let map, markersLayer, routeLayer, mapTypes = {};
  function showMap() {
    if (!window.L) { $('#map').innerHTML = '<div class="empty">지도 라이브러리를 불러오지 못했습니다(오프라인?). 카드의 카카오맵 링크를 이용하세요.</div>'; return; }
    if (!map) {
      map = L.map('map', { scrollWheelZoom: true }).setView([37.55, 126.98], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      markersLayer = L.layerGroup().addTo(map); routeLayer = L.layerGroup().addTo(map);
      T.types.forEach(t => mapTypes[t.id] = true);
      $('#map-types').innerHTML = T.types.map(t => `<button data-mt="${t.id}" class="on" style="--c:${t.color}">${t.emoji} ${t.label}</button>`).join('');
      $('#map-legend').innerHTML = T.types.map(t => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('') + '<span><i style="background:var(--accent)"></i>동선 순번</span>';
      const src = $('#map-source'); src.innerHTML = `<option value="">동선 없음 (전체 핀)</option><option value="mine">✏️ 내 일정</option>` + PLANS.map(p => `<option value="plan-${p.id}">${p.name}</option>`).join('');
      const ds = $('#map-day'); ds.innerHTML = `<option value="">전체 일자</option>` + T.meta.days.map(d => `<option value="${d.id}">${d.label}</option>`).join('');
      src.addEventListener('change', drawMap); ds.addEventListener('change', drawMap);
      $('#map-fit').addEventListener('click', () => fitAll());
      $('#map-types').addEventListener('click', e => { const b = e.target.closest('[data-mt]'); if (!b) return; mapTypes[b.dataset.mt] = !mapTypes[b.dataset.mt]; b.classList.toggle('on', mapTypes[b.dataset.mt]); drawMap(); });
      map.on('popupopen', e => { const btn = e.popup.getElement().querySelector('[data-mopen]'); if (btn) btn.onclick = () => openDetail(btn.dataset.mopen); });
    }
    // 해시 파라미터: #map/<placeId> 또는 #map/plan-A/d1
    const parts = location.hash.split('/');
    if (parts[1]) {
      if (parts[1].startsWith('plan-') || parts[1] === 'mine') { $('#map-source').value = parts[1]; if (parts[2]) $('#map-day').value = parts[2]; }
      else if (byId[parts[1]]) { setTimeout(() => { const p = byId[parts[1]]; map.setView([p.lat, p.lng], 15); markersLayer.eachLayer(m => { if (m.options.pid === p.id) m.openPopup(); }); }, 250); }
    }
    setTimeout(() => { map.invalidateSize(); drawMap(); }, 60);
  }
  function fitAll() { const pts = T.places.filter(p => mapTypes[p.type]).map(p => [p.lat, p.lng]); if (pts.length) map.fitBounds(pts, { padding: [30, 30] }); }
  function drawMap() {
    markersLayer.clearLayers(); routeLayer.clearLayers();
    T.places.filter(p => mapTypes[p.type]).forEach(p => {
      L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: typeById[p.type].color, fillOpacity: .95, pid: p.id })
        .bindPopup(`<b>${esc(p.name)}</b>${esc(regionById[p.region]?.label || '')} · ${p.dur ? p.dur + '분' : ''} · 5인 ${won(familyCost(p))}<br><button data-mopen="${p.id}">상세 보기</button> <a href="${kakaoTo(p)}" target="_blank" rel="noopener">길찾기 ↗</a>`)
        .addTo(markersLayer);
    });
    const src = $('#map-source').value, dayF = $('#map-day').value;
    if (src) {
      const daysSel = T.meta.days.filter(d => !dayF || d.id === dayF);
      const colors = ['#e8842c', '#3b63b8', '#2e8b6e', '#b04a8c', '#c9552f'];
      const allPts = [];
      daysSel.forEach((d, di) => {
        const slots = src === 'mine' ? S.mine[d.id] : (PLANS.find(p => p.id === src.slice(5))?.days[d.id] || []);
        const pts = slots.filter(s => s.p && byId[s.p]).map(s => byId[s.p]);
        if (!pts.length) return;
        const latlngs = pts.map(p => [p.lat, p.lng]); allPts.push(...latlngs);
        L.polyline(latlngs, { color: colors[T.meta.days.indexOf(d) % colors.length], weight: 4, opacity: .75, dashArray: di ? null : null }).addTo(routeLayer);
        pts.forEach((p, i) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="num-marker" style="background:${colors[T.meta.days.indexOf(d) % colors.length]}">${i + 1}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).bindTooltip(`${d.label} · ${i + 1}. ${p.name}`).on('click', () => openDetail(p.id)).addTo(routeLayer));
      });
      if (allPts.length) map.fitBounds(allPts, { padding: [40, 40] });
    } else if (!location.hash.split('/')[1]) fitAll();
  }

  // D-day, 맨 위로
  (function () {
    const d = Math.ceil((new Date('2027-01-19T00:00:00+09:00') - Date.now()) / 86400000);
    $('#dday').textContent = d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : `여행 후 ${-d}일`;
    const top = $('#btn-top');
    window.addEventListener('scroll', () => { top.hidden = window.scrollY < 600; }, { passive: true });
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  })();

  /* ---------- 가족 실시간 공유 (Firebase Realtime Database 스트리밍 + 셀 단위 LWW 병합) ---------- */
  const FB_RULES = '{\n  "rules": {\n    "rooms": {\n      "$room": { ".read": true, ".write": true }\n    }\n  }\n}';
  const SYNC = (() => {
    let es = null, pollTimer = null, pushTimer = null, retryTimer = null, busy = false, esFails = 0;
    const dirty = new Set(); // 'vt/장소/가족원' 또는 'mem/가족원' — 아직 서버에 안 올린 로컬 변경
    const now = () => Date.now();
    const isFirebase = url => /firebaseio\.com|firebasedatabase\.app/i.test(url);
    const state = () => ({ v: 1, app: 'seoul-winter-trip', vt: S.vt, mem: S.mem, updatedAt: now() });
    // Firebase 멀티패스 패치는 최상위 키가 "vt/nmk/k1"처럼 납작하게 옴 → 중첩 객체로 펼침
    function expand(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        const segs = k.split('/').filter(Boolean); let cur = out;
        segs.forEach((s, i) => { if (i === segs.length - 1) cur[s] = (cur[s] && typeof cur[s] === 'object' && v && typeof v === 'object') ? Object.assign(cur[s], v) : v; else cur = cur[s] = (cur[s] && typeof cur[s] === 'object') ? cur[s] : {}; });
      });
      return out;
    }
    function partialFromPath(path, data) {
      const segs = (path || '/').split('/').filter(Boolean);
      if (!segs.length) return expand(data) || {};
      const root = {}; let cur = root;
      segs.forEach((s, i) => { cur[s] = i === segs.length - 1 ? data : {}; cur = cur[s]; });
      return root;
    }
    function merge(remote) {
      let changed = false; const newer = [];
      const rv = (remote && remote.vt) || {}, rm = (remote && remote.mem) || {};
      for (const pid in rv) for (const mid in rv[pid] || {}) {
        const r = rv[pid][mid]; if (!r || typeof r !== 'object') continue;
        const l = S.vt[pid] && S.vt[pid][mid];
        if (!l || (r.ts || 0) > (l.ts || 0)) { (S.vt[pid] = S.vt[pid] || {})[mid] = { on: !!r.on, ts: r.ts || 0 }; changed = true; }
        else if ((l.ts || 0) > (r.ts || 0)) newer.push(`vt/${pid}/${mid}`);
      }
      for (const mid in rm) { const r = rm[mid]; if (!r || typeof r !== 'object') continue; const l = S.mem[mid]; if (!l || (r.ts || 0) > (l.ts || 0)) { S.mem[mid] = { name: String(r.name || ''), ts: r.ts || 0 }; changed = true; } else if ((l.ts || 0) > (r.ts || 0)) newer.push(`mem/${mid}`); }
      return { changed, newer, isFull: !!remote };
    }
    // 전체 문서(초기 put)와 비교해 서버에 없는 로컬 셀을 찾음
    function missingRemote(remote) {
      const out = []; const rv = (remote && remote.vt) || {}, rm = (remote && remote.mem) || {};
      for (const pid in S.vt) for (const mid in S.vt[pid]) if (!(rv[pid] && rv[pid][mid])) out.push(`vt/${pid}/${mid}`);
      for (const mid in S.mem) if (!rm[mid]) out.push(`mem/${mid}`);
      return out;
    }
    function afterChange(changed) { save(); if (changed) { renderHome(); renderPool(); if ($('#modal').hidden === false && $('#modal-card').dataset.pid) openDetail($('#modal-card').dataset.pid); } else renderSyncStatus(); }
    async function req(method, body) {
      const r = await fetch(S.sync.url, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
      if (r.status === 401 || r.status === 403) throw new Error('권한 없음 — Firebase 규칙(.read/.write)을 확인하세요');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return method === 'GET' ? r.json() : null;
    }
    function patchBody() {
      const body = {};
      dirty.forEach(p => { const s = p.split('/'); if (s[0] === 'vt') { const c = S.vt[s[1]] && S.vt[s[1]][s[2]]; if (c) body[p] = c; } else if (s[0] === 'mem' && S.mem[s[1]]) body[p] = S.mem[s[1]]; });
      body.updatedAt = now(); return body;
    }
    async function push() {
      if (!S.sync.url) return; if (busy) { schedulePush(); return; } busy = true;
      try {
        if (S.sync.kind === 'firebase') { if (dirty.size) await req('PATCH', patchBody()); }
        else { const remote = await req('GET').catch(() => null); if (remote) merge(remote); await req('PUT', state()); }
        dirty.clear(); S.sync.last = now(); S.sync.err = ''; save(); renderSyncStatus();
      } catch (e) { S.sync.err = e.message; save(); renderSyncStatus(); clearTimeout(retryTimer); retryTimer = setTimeout(push, 5000); }
      finally { busy = false; }
    }
    function schedulePush() { if (!S.sync.url) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 400); }
    function markDirty(path) { if (!S.sync.url) return; dirty.add(path); schedulePush(); }
    function markAllDirty() { Object.entries(S.vt).forEach(([pid, ms]) => Object.keys(ms).forEach(mid => dirty.add(`vt/${pid}/${mid}`))); Object.keys(S.mem).forEach(mid => dirty.add(`mem/${mid}`)); }
    async function pull(force) {
      if (!S.sync.url || busy) return; busy = true;
      try { const remote = await req('GET'); const m = merge(remote || {}); m.newer.concat(missingRemote(remote)).forEach(p => dirty.add(p)); S.sync.last = now(); S.sync.err = ''; afterChange(m.changed || force); }
      catch (e) { S.sync.err = e.message; save(); renderSyncStatus(); }
      finally { busy = false; if (dirty.size) schedulePush(); }
    }
    function applyStream(path, data, type) {
      const full = type === 'put' && (!path || path === '/'); // 초기 전체 스냅샷만 '전체'로 취급 (patch는 부분)
      const remote = (!path || path === '/') ? (expand(data) || {}) : partialFromPath(path, data);
      const m = merge(remote);
      if (full) missingRemote(remote).forEach(p => dirty.add(p));
      m.newer.forEach(p => dirty.add(p));
      S.sync.last = now(); S.sync.err = ''; esFails = 0;
      afterChange(m.changed);
      if (dirty.size) schedulePush();
    }
    function startStream() {
      if (!window.EventSource) return false;
      try { es = new EventSource(S.sync.url); } catch (e) { return false; }
      const onMsg = e => { try { const o = JSON.parse(e.data); if (window.__syncLog) console.debug('[sync]', e.type, JSON.stringify(o).slice(0, 200)); applyStream(o.path, o.data, e.type); } catch (err) { /* 무시 */ } };
      es.addEventListener('put', onMsg); es.addEventListener('patch', onMsg);
      es.addEventListener('cancel', () => { S.sync.err = '읽기 권한이 취소됨 — 규칙 확인'; save(); renderSyncStatus(); });
      es.onerror = () => { esFails++; if (esFails >= 3) { if (es) es.close(); es = null; startPoll(); S.sync.err = ''; } renderSyncStatus(); };
      return true;
    }
    function startPoll() { stopPoll(); pull(true); pollTimer = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 5000); }
    function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
    function start() { stop(); if (!S.sync.url) { renderSyncStatus(); return; } if (!(S.sync.kind === 'firebase' && startStream())) startPoll(); }
    function stop() { if (es) { es.close(); es = null; } stopPoll(); clearTimeout(pushTimer); clearTimeout(retryTimer); esFails = 0; }
    const mode = () => S.sync.kind === 'firebase' ? (es && !pollTimer ? 'Firebase 실시간' : 'Firebase (5초 폴링)') : '직접 주소 (5초 폴링)';
    function normalizeFirebase(dbUrl, room) {
      let u = (dbUrl || '').trim().replace(/\/+$/, '');
      if (!u) throw new Error('데이터베이스 주소를 입력하세요');
      if (/\.json(\?.*)?$/.test(u)) return u;
      if (!/^https:\/\//.test(u) && !/^http:\/\/localhost/.test(u)) throw new Error('https:// 로 시작하는 데이터베이스 주소를 입력하세요');
      const r = (room || '').trim().replace(/[^\w-]/g, '') || ('family-' + Math.random().toString(36).slice(2, 8));
      return `${u}/rooms/${r}.json`;
    }
    async function createFirebaseRoom(dbUrl, room) {
      const url = normalizeFirebase(dbUrl, room);
      const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }).catch(() => { throw new Error('주소에 연결할 수 없습니다 — 오타 또는 네트워크 확인'); });
      if (r.status === 401 || r.status === 403) throw new Error('규칙이 아직 닫혀 있습니다 — 3단계(규칙 게시)를 확인하세요');
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — 주소를 확인하세요');
      let remote = null; try { remote = await r.json(); } catch (e) { throw new Error('JSON 응답이 아닙니다 — Realtime Database 주소가 맞는지 확인'); }
      stop(); S.sync.kind = 'firebase'; S.sync.url = url; S.sync.err = ''; S.sync.last = 0;
      merge(remote || {}); markAllDirty();
      const body = patchBody(); body.v = 1; body.app = 'seoul-winter-trip';
      const w = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!w.ok) { S.sync.url = ''; S.sync.kind = ''; throw new Error(w.status === 401 || w.status === 403 ? '쓰기 규칙이 닫혀 있습니다 — 규칙 게시 확인' : 'HTTP ' + w.status); }
      dirty.clear(); S.sync.last = now(); save(); start();
    }
    function connect(kind, url) { stop(); S.sync.kind = kind; S.sync.url = url; S.sync.err = ''; S.sync.last = 0; save(); markAllDirty(); start(); }
    function join(tokenOrUrl) {
      let kind = '', url = (tokenOrUrl || '').trim();
      if (!/^https?:/.test(url)) { const o = JSON.parse(b64d(url)); kind = o.k || ''; url = o.u; }
      if (!/^https:\/\/|^http:\/\/localhost/.test(url)) throw new Error('https 주소만 연결할 수 있습니다');
      if (!kind || kind === 'jsonblob') kind = isFirebase(url) ? 'firebase' : 'url';
      connect(kind, url);
    }
    const token = () => b64e(JSON.stringify({ k: S.sync.kind, u: S.sync.url }));
    const link = (mid) => `${location.origin}${location.pathname}#home/room=${token()}${mid ? '&me=' + mid : ''}`;
    function leave() { stop(); dirty.clear(); S.sync = Object.assign({}, S.sync, { kind: '', url: '', last: 0, err: '' }); save(); renderHome(); }
    const debug = () => ({ kind: S.sync.kind, url: S.sync.url, es: es ? es.readyState : null, poll: !!pollTimer, dirty: [...dirty], esFails, busy, last: S.sync.last, err: S.sync.err });
    return { start, stop, pull, push, markDirty, markAllDirty, schedulePush, createFirebaseRoom, join, link, leave, token, mode, debug };
  })();

  const fmtAgo = ts => { if (!ts) return ''; const s = Math.round((Date.now() - ts) / 1000); return s < 5 ? '방금' : s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
  function renderSyncStatus() {
    const el = $('#sync-status'); if (!el) return;
    if (!S.sync.url) { el.innerHTML = '<span class="dot off"></span> 이 기기에만 저장 중 — 아래 안내대로 Firebase 가족방을 만들면 서로의 찜이 실시간으로 보입니다'; return; }
    el.innerHTML = S.sync.err ? `<span class="dot err"></span> ${esc(S.sync.err)} · 자동 재시도 중` : `<span class="dot on"></span> 가족 공유 중 · ${SYNC.mode()} · 마지막 갱신 ${S.sync.last ? fmtAgo(S.sync.last) : '…'}`;
  }
  function renderWhoChip() {
    const chip = $('#who-chip'); if (!chip) return;
    if (!S.sync.url && !S.sync.me) { chip.hidden = true; return; }
    chip.hidden = false; const m = T.members.find(x => x.id === S.sync.me);
    chip.className = 'who-chip' + (m ? '' : ' none'); chip.textContent = m ? `${m.emoji} ${memberName(m)}` : '누구세요?';
  }
  function openWho(force) {
    if (!S.sync.url && !force) return; let skipped = false; try { skipped = !!sessionStorage.getItem('whoSkipped'); } catch (e) { /* ignore */ }
    if (!force && (S.sync.me || skipped)) return;
    $('#who-grid').innerHTML = T.members.map(m => `<button data-who="${m.id}" class="${S.sync.me === m.id ? 'on' : ''}"><span class="em">${m.emoji}</span><span class="nm">${esc(memberName(m))}</span><span class="sb">${esc(m.sub || (m.id === 'dad' ? '아빠' : m.id === 'mom' ? '엄마' : ''))}</span></button>`).join('');
    showOverlay('#who');
  }
  function openLinks() {
    $('#link-list').innerHTML = T.members.map(m => `<div class="row"><span class="em">${m.emoji}</span><b>${esc(memberName(m))} 전용 링크</b><button class="btn small primary" data-linkfor="${m.id}">복사·보내기</button></div>`).join('') +
      `<div class="row common"><span class="em">👨‍👩‍👧‍👦</span><b>공통 링크 (열 때 "누구세요?" 선택)</b><button class="btn small" data-linkfor="">복사·보내기</button></div>`;
    showOverlay('#links');
  }
  function renderSyncCard() {
    const el = $('#sync-card'); if (!el) return;
    const me = S.sync.me;
    const meChips = T.members.map(m => `<button data-me="${m.id}" class="${me === m.id ? 'on' : ''}">${m.emoji} ${esc(memberName(m))}<small>${esc(m.sub || '')}</small></button>`).join('');
    const acts = []; Object.entries(S.vt).forEach(([pid, ms]) => Object.entries(ms).forEach(([mid, v]) => { if (v.ts > 1 && byId[pid]) acts.push({ pid, mid, on: v.on, ts: v.ts }); }));
    acts.sort((a, b) => b.ts - a.ts);
    const feed = acts.slice(0, 6).map(a => { const m = T.members.find(x => x.id === a.mid); return `<li>${m ? m.emoji + ' ' + esc(memberName(m)) : '?'} ${a.on ? '❤️' : '💔'} <button class="link-btn" data-open="${a.pid}">${esc(byId[a.pid].name)}</button> <span class="muted">${fmtAgo(a.ts)}</span></li>`; }).join('');
    const connected = !!S.sync.url;
    const room = connected ? (S.sync.url.match(/\/rooms\/([^/.]+)\.json/) || [])[1] : '';
    el.innerHTML = `
      <div class="me-row"><span class="small muted">나는</span><div class="me-chips">${meChips}</div></div>
      <p class="sync-status" id="sync-status"></p>
      <div class="sync-actions">${connected
        ? `<button class="btn small primary" id="sync-link">🔗 가족 링크 복사</button><button class="btn small" id="sync-now">🔄 지금 갱신</button><button class="btn small danger" id="sync-leave">연결 해제</button>${room ? `<span class="small muted">방 이름: <b>${esc(room)}</b></span>` : ''}`
        : `<div class="fb-guide">
            <b>🔥 Firebase로 가족방 만들기 (무료 · 약 5분, 한 사람만 하면 됩니다)</b>
            <ol>
              <li><a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a>에 구글 계정으로 로그인 → <b>프로젝트 추가</b> (이름 아무거나, 애널리틱스는 꺼도 됨)</li>
              <li>왼쪽 메뉴 <b>빌드 → Realtime Database → 데이터베이스 만들기</b> (위치 <b>asia-southeast1</b> 권장, <b>잠금 모드</b>로 시작)</li>
              <li><b>규칙</b> 탭의 내용을 아래 것으로 바꾸고 <b>게시</b> <button class="btn small" id="fb-copy-rules">📋 규칙 복사</button><pre class="rules">${esc(FB_RULES)}</pre></li>
              <li><b>데이터</b> 탭 위쪽에 보이는 주소(<code>https://…firebasedatabase.app</code>)를 복사해 아래에 붙여넣고 <b>가족방 만들기</b></li>
            </ol>
            <div class="toolbar"><input type="url" id="fb-url" placeholder="https://프로젝트명-default-rtdb.asia-southeast1.firebasedatabase.app" autocomplete="off"><input type="text" id="fb-room" placeholder="방 이름 (비우면 자동 생성)" autocomplete="off" style="flex:0 1 180px"><button class="btn small primary" id="fb-create">🔥 가족방 만들기</button></div>
            <p class="small muted">방 주소를 아는 사람만 읽고 쓸 수 있습니다. 방 이름은 자동 생성(추측 어려운 값)을 권장합니다. 만든 뒤 "가족 링크 복사"로 가족에게 보내면 링크를 연 폰이 자동으로 합류합니다.</p>
            <details class="sync-more"><summary>가족 링크 코드나 다른 JSON 저장소 주소로 연결</summary>
              <div class="toolbar"><input type="text" id="sync-url" placeholder="가족 링크의 room= 뒤 코드, 또는 https://…/rooms/이름.json"><button class="btn small" id="sync-join">연결</button></div>
            </details>
          </div>`}
      </div>
      ${feed ? `<h3 class="mt small-h">최근 찜 활동</h3><ul class="activity">${feed}</ul>` : ''}`;
    renderSyncStatus(); renderWhoChip();
  }
  document.addEventListener('click', async e => {
    const me = e.target.closest('[data-me]'); if (me) { S.sync.me = S.sync.me === me.dataset.me ? '' : me.dataset.me; save(); renderSyncCard(); return; }
    if (e.target.id === 'fb-copy-rules') { try { await navigator.clipboard.writeText(FB_RULES); toast('규칙을 복사했습니다 — Firebase 규칙 탭에 붙여넣고 게시'); } catch (err) { prompt('아래 규칙을 복사하세요', FB_RULES); } return; }
    if (e.target.id === 'fb-create') { const btn = e.target; btn.disabled = true; btn.textContent = '연결 중…'; try { await SYNC.createFirebaseRoom($('#fb-url').value, $('#fb-room').value); renderHome(); toast('가족방을 만들었습니다 — "가족 링크 복사"로 가족에게 보내세요'); openWho(false); } catch (err) { alert('가족방 만들기 실패: ' + err.message); btn.disabled = false; btn.textContent = '🔥 가족방 만들기'; } return; }
    if (e.target.id === 'sync-join') { try { SYNC.join($('#sync-url').value); renderHome(); toast('연결했습니다'); openWho(false); } catch (err) { alert('연결 실패: ' + err.message); } return; }
    if (e.target.id === 'sync-link') { openLinks(); return; }
    const lb = e.target.closest('[data-linkfor]'); if (lb) { const mid = lb.dataset.linkfor, m = T.members.find(x => x.id === mid); const url = SYNC.link(mid || ''); const title = m ? `${memberName(m)} 전용 가족방 링크` : '서울 겨울 가족여행 — 가족방 공통 링크'; try { if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title, text: title, url }); return; } await navigator.clipboard.writeText(url); toast(`${m ? memberName(m) + ' 전용' : '공통'} 링크를 복사했습니다`); } catch (err) { prompt('아래 링크를 복사하세요', url); } return; }
    const wb = e.target.closest('#who-grid [data-who]'); if (wb) { S.sync.me = wb.dataset.who; save(); hideOverlays(false); renderHome(); renderPool(); renderWhoChip(); toast(`${memberName(T.members.find(m => m.id === S.sync.me))}(으)로 시작합니다`); return; }
    if (e.target.id === 'who-skip') { hideOverlays(false); try { sessionStorage.setItem('whoSkipped', '1'); } catch (err) { /* ignore */ } renderWhoChip(); return; }
    if (e.target.closest('[data-pickme]')) { openWho(true); return; }
    if (e.target.id === 'who-chip') { openWho(true); return; }
    if (e.target.id === 'sync-now') { SYNC.pull(true); toast('갱신 중…'); return; }
    if (e.target.id === 'sync-leave') { if (confirm('가족방 연결을 해제할까요? (찜은 이 기기에 남습니다)')) SYNC.leave(); return; }
  });
  setInterval(renderSyncStatus, 10000);

  /* ---------- 초기화 ---------- */
  function renderAll() { renderHome(); renderPool(); renderPlans(); renderMine(); }
  window.__trip = { debug: () => SYNC.debug(), state: () => S };
  applyTheme(); renderAll(); checkShareHash(); route(); SYNC.start(); renderWhoChip(); openWho(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') SYNC.pull(); });
})();
