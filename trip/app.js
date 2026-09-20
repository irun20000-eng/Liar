/* ===== 서울 겨울 가족여행 플래너 — 앱 ===== */
(function () {
  'use strict';
  const T = window.TRIP, PLANS = window.PLANS;
  const byId = Object.fromEntries(T.places.map(p => [p.id, p]));
  const typeById = Object.fromEntries(T.types.map(t => [t.id, t]));
  const regionById = Object.fromEntries(T.regions.map(r => [r.id, r]));
  const dayById = Object.fromEntries(T.meta.days.map(d => [d.id, d]));
  const KEY = 'seoulTrip2027.v1';

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
    theme: 'auto', members: {}, votes: {}, checks: {},
    mine: Object.fromEntries(T.meta.days.map(d => [d.id, []])),
    mineStart: Object.fromEntries(T.meta.days.map(d => [d.id, d.start])),
    planId: 'A', planDay: 'd1', mineDay: 'd1', poolType: '', poolFilters: {}, poolSort: 'rec', poolRegion: ''
  });
  let S = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(defaults(), JSON.parse(raw)); } catch (e) { /* 저장 불가 환경 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const memberName = m => S.members[m.id] || m.name;
  const voteCount = pid => (S.votes[pid] || []).length;

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
      html += `<div class="slot ${kind}" data-slot="${r.i}">
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
      { id: 'stay', when: '지금 ~ 11월', title: '숙소 예약 (5인 1실 · 주차 확인)', sub: '용산권 4박 고정 권장. 연말·연초 성수기 전에' },
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

    // 랭킹
    const ranked = T.places.filter(p => voteCount(p.id) > 0).sort((a, b) => voteCount(b.id) - voteCount(a.id) || a.name.localeCompare(b.name)).slice(0, 12);
    $('#vote-ranking').innerHTML = ranked.length ? ranked.map(p => `<li><button data-open="${p.id}">${esc(p.name)}</button><span class="hearts">${(S.votes[p.id] || []).map(mid => T.members.find(m => m.id === mid)?.emoji || '❤️').join(' ')} · ${voteCount(p.id)}표</span></li>`).join('') : '<li class="muted">아직 찜한 장소가 없습니다. 장소 카드를 열어 하트를 눌러보세요.</li>';
  }
  $('#view-home').addEventListener('change', e => {
    if (e.target.dataset.check) { S.checks[e.target.dataset.check] = e.target.checked; save(); renderHome(); }
    if (e.target.dataset.member) { S.members[e.target.dataset.member] = e.target.value.trim() || T.members.find(m => m.id === e.target.dataset.member).name; save(); renderHome(); }
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
    return `<article class="pcard" style="--tc:${t.color}" data-open="${p.id}" tabindex="0" role="button">
      <div class="pcard-top"><div><h3>${esc(p.name)}</h3><div class="region">📍 ${esc(regionById[p.region]?.label || '')} · ${p.dur ? p.dur + '분' : '숙박'}</div></div>${statusChip(p)}</div>
      <p class="why">${esc(p.why)}</p>
      <div class="age-row"><span>중2 ${stars(p.ages.k1)}</span><span>초6 ${stars(p.ages.k2)}</span><span>초3 ${stars(p.ages.k3)}</span></div>
      <div class="pcard-foot"><div class="chips">${typeChip(p)}${familyCost(p) === 0 && p.type !== 'stay' ? '<span class="chip free">무료</span>' : `<span class="chip">5인 ${won(familyCost(p))}</span>`}${p.reserve === 'required' ? '<span class="chip">예약</span>' : ''}${p.indoor === true ? '<span class="chip">실내</span>' : ''}</div>${voteCount(p.id) ? `<span class="hearts-mini">❤️ ${voteCount(p.id)}</span>` : ''}</div>
    </article>`;
  }
  function renderPool() {
    const counts = Object.fromEntries(T.types.map(t => [t.id, T.places.filter(p => inType(p, t.id)).length]));
    $('#type-tabs').innerHTML = [`<button data-type="" class="${!S.poolType ? 'on' : ''}">전체 <b>${T.places.length}</b></button>`]
      .concat(T.types.map(t => `<button data-type="${t.id}" class="${S.poolType === t.id ? 'on' : ''}">${t.emoji} ${t.label} <b>${counts[t.id]}</b></button>`)).join('');
    const rs = $('#pool-region'); if (rs.options.length === 1) T.regions.forEach(r => rs.add(new Option(r.label, r.id)));
    rs.value = S.poolRegion; $('#pool-sort').value = S.poolSort;
    $$('#pool-filters button').forEach(b => b.classList.toggle('on', !!S.poolFilters[b.dataset.f]));
    const list = poolList($('#pool-q').value, S.poolType, S.poolFilters, S.poolRegion, S.poolSort);
    $('#pool-count').textContent = `${list.length}개 표시 · 5인 비용은 성인2·청소년1·어린이2 기준 추정`;
    $('#pool-cards').innerHTML = list.map(cardHTML).join('') || '<p class="empty">조건에 맞는 장소가 없습니다.</p>';
  }
  $('#type-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.poolType = b.dataset.type; save(); renderPool(); });
  $('#pool-filters').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.poolFilters[b.dataset.f] = !S.poolFilters[b.dataset.f]; save(); renderPool(); });
  $('#pool-q').addEventListener('input', renderPool);
  $('#pool-region').addEventListener('change', e => { S.poolRegion = e.target.value; save(); renderPool(); });
  $('#pool-sort').addEventListener('change', e => { S.poolSort = e.target.value; save(); renderPool(); });

  /* ---------- 상세 모달 ---------- */
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
      ${p.tips ? `<div class="tips"><b>비고</b> · ${esc(p.tips)}</div>` : ''}
      <div class="links">
        ${p.links?.official ? `<a class="btn small" href="${p.links.official}" target="_blank" rel="noopener">🔗 공식</a>` : ''}
        ${p.links?.booking ? `<a class="btn small" href="${p.links.booking}" target="_blank" rel="noopener">🎟️ 예약·예매</a>` : ''}
        <a class="btn small" href="${naverSearch(p)}" target="_blank" rel="noopener">🟢 네이버지도</a>
        <a class="btn small" href="${kakaoSearch(p)}" target="_blank" rel="noopener">🟡 카카오맵</a>
        <a class="btn small" href="${kakaoTo(p)}" target="_blank" rel="noopener">🚗 길찾기</a>
        <a class="btn small" href="#map/${p.id}" data-close>🗺️ 지도에서</a>
      </div>
      <div class="vote-row">${T.members.map(m => `<button data-vote="${m.id}" class="${(S.votes[pid] || []).includes(m.id) ? 'on' : ''}">${m.emoji} ${esc(memberName(m))} ${(S.votes[pid] || []).includes(m.id) ? '❤️' : '♡'}</button>`).join('')}</div>
      <div class="add-row"><span class="small muted">내 일정에 담기 →</span><select id="detail-day">${T.meta.days.map(d => `<option value="${d.id}" ${d.id === S.mineDay ? 'selected' : ''}>${d.label}</option>`).join('')}</select><button class="btn primary small" data-add="${pid}">＋ 추가</button></div>
    </div>`;
    $('#modal').hidden = false; document.body.style.overflow = 'hidden';
    $('#modal-card').dataset.pid = pid;
  }
  function closeModals() { $('#modal').hidden = true; $('#picker').hidden = true; document.body.style.overflow = ''; }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { closeModals(); return; }
    const o = e.target.closest('[data-open]'); if (o) { openDetail(o.dataset.open); return; }
    const v = e.target.closest('[data-vote]'); if (v) {
      const pid = $('#modal-card').dataset.pid, mid = v.dataset.vote; const arr = S.votes[pid] || []; const i = arr.indexOf(mid);
      if (i >= 0) arr.splice(i, 1); else arr.push(mid); S.votes[pid] = arr; save(); openDetail(pid); renderHome(); renderPool(); return;
    }
    const a = e.target.closest('[data-add]'); if (a) { addPlace(a.dataset.add, $('#detail-day').value); closeModals(); return; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); if (e.key === 'Enter' && e.target.classList?.contains('pcard')) openDetail(e.target.dataset.open); });

  /* ---------- 추천 일정 ---------- */
  function renderPlans() {
    const plan = PLANS.find(p => p.id === S.planId) || PLANS[0];
    $('#plan-picker').innerHTML = PLANS.map(p => `<button class="plan-btn ${p.id === plan.id ? 'on' : ''}" data-plan="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tag)}</span></button>`).join('');
    const stay = byId[plan.stay];
    const days = T.meta.days.map(d => computeDay(plan.days[d.id] || [], d, d.start));
    const total = days.reduce((a, c) => a + c.cost, 0), food = days.reduce((a, c) => a + c.foodCost, 0);
    $('#plan-summary').innerHTML = `<h2>${esc(plan.name)}</h2><p class="fit">👨‍👩‍👧‍👦 이런 가족에게: ${esc(plan.fit)}</p><p>${esc(plan.summary)}</p><div class="kv"><span>🏨 숙소: <button class="link-btn" data-open="${stay.id}" style="border:0;background:none;padding:0;font:inherit;color:var(--navy);text-decoration:underline dotted;cursor:pointer">${esc(stay.name)}</button></span><span>🎟️ 입장·체험·공연 5인 <b>${won(total - food)}</b></span><span>🍜 식비 추정 <b>${won(food)}</b></span><span>💡 ${esc(plan.budgetHint)}</span></div>`;
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
    const cost = tot.reduce((a, c) => a + c.cost, 0), food = tot.reduce((a, c) => a + c.foodCost, 0), n = tot.reduce((a, c) => a + c.nPlaces, 0);
    const warns = tot.reduce((a, c) => a + c.rows.reduce((b, r) => b + r.warns.length + (r.fixed && r.slack < -10 ? 1 : 0), 0), 0);
    $('#budget').innerHTML = `<div><b>${n}</b><span>장소·활동</span></div><div><b>${won(cost - food)}</b><span>입장·체험 (5인)</span></div><div><b>${won(food)}</b><span>식비 추정 (5인)</span></div><div><b style="color:${warns ? 'var(--warn)' : 'var(--good)'}">${warns}</b><span>충돌 경고</span></div>`;
    void d;
  }
  $('#mine-day-tabs').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; S.mineDay = b.dataset.day; save(); renderMine(); });
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
    const data = { app: 'seoul-winter-trip', version: 1, exportedAt: new Date().toISOString(), members: S.members, votes: S.votes, checks: S.checks, mine: S.mine, mineStart: S.mineStart };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `seoul-trip-2027-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast('JSON 파일로 내보냈습니다');
  });
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const d = JSON.parse(txt); if (d.app !== 'seoul-winter-trip') throw new Error('형식이 다릅니다');
      if (!confirm('가져온 내용으로 내 일정·찜·체크를 덮어쓸까요?')) return;
      ['members', 'votes', 'checks', 'mine', 'mineStart'].forEach(k => { if (d[k]) S[k] = d[k]; });
      T.meta.days.forEach(x => { S.mine[x.id] = S.mine[x.id] || []; S.mineStart[x.id] = S.mineStart[x.id] || x.start; });
      save(); renderAll(); toast('가져오기 완료');
    }).catch(err => alert('가져오기 실패: ' + err.message)).finally(() => { e.target.value = ''; });
  });

  // 장소 선택 모달
  let pickerDay = null;
  function openPicker() {
    pickerDay = S.mineDay;
    const ts = $('#picker-type'); if (ts.options.length === 1) T.types.forEach(t => ts.add(new Option(`${t.emoji} ${t.label}`, t.id)));
    $('#picker').hidden = false; document.body.style.overflow = 'hidden'; renderPicker(); setTimeout(() => $('#picker-q').focus(), 50);
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
    return b64e(JSON.stringify({ v: 1, st: T.meta.days.map(d => S.mineStart[d.id]), m: S.members, d: days }));
  }
  function applyShare(code) {
    const o = JSON.parse(b64d(code)); if (o.v !== 1 || !Array.isArray(o.d)) throw new Error('형식 오류');
    T.meta.days.forEach((d, i) => {
      S.mine[d.id] = (o.d[i] || []).map(a => ({ id: uid(), p: a[0] || undefined, title: a[1] || undefined, kind: a[2] || undefined, dur: a[3], fixed: a[4] || null, act: a[5] || '', note: a[6] || '' })).filter(s => !s.p || byId[s.p]);
      S.mineStart[d.id] = (o.st && o.st[i]) || d.start;
    });
    if (o.m) S.members = o.m;
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

  /* ---------- 초기화 ---------- */
  function renderAll() { renderHome(); renderPool(); renderPlans(); renderMine(); }
  applyTheme(); renderAll(); checkShareHash(); route();
})();
