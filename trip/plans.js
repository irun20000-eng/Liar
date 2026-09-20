/* =========================================================
   추천 일정 — 상황별 5개 안
   slot: { t:'HH:MM', p:'placeId' }            → 장소 카드 참조 (소요시간은 카드 기본값, dur로 덮어쓰기 가능)
         { t:'HH:MM', title:'...', dur:분, kind:'move'|'custom'|'rest' }  → 이동·자유 슬롯
   act  : 그 슬롯에서 무엇을 하는지 한 줄
   note : 비고(참고사항)
   ========================================================= */
window.PLANS = [
  {
    id: 'A', name: 'A. 서울 정석 코스',
    tag: '박물관·명소 중심 · 균형형',
    fit: '처음 서울 가족여행 · 세 아이 취향이 고르게 갈릴 때',
    summary: '국립중앙박물관을 축으로 광화문·여의도·잠실 3개 권역을 하루씩. 무료·저비용 위주라 5인 예산 부담이 가장 적음.',
    stay: 'stay_fraser',
    budgetHint: '공연(페인터즈)·전망대·아쿠아리움이 비용의 대부분 — 빼면 절반 이하',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발 (경부고속도로)', dur: 150, kind: 'move', act: '저녁은 휴게소(죽암·안성) or 도착 후', note: '화요일 저녁 상행은 원활. 서울 진입 후 한남대교~용산 구간 20분 여유' },
        { t: '20:30', p: 'stay_fraser', dur: 40, act: '체크인·짐 풀기', note: '늦은 체크인 사전 고지' },
        { t: '21:25', p: 'nodeul', dur: 30, act: '한강 야경 30분 — "서울 왔다" 신고식', note: '피곤하면 생략. 숙소 편의점 야식으로 대체' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '사유의 방 → 실감영상관 → 어린이박물관(예약 회차)', note: '★ 수요일 야간개장(21시)이라 시간 압박 없음. 어린이박물관 예약: 1/6 0시 오픈' },
        { t: '13:20', p: 'nmk_food', act: '박물관 내 점심', note: '이동 없이 해결' },
        { t: '14:30', p: 'warmemorial', dur: 100, act: '야외 전시장(전투기·탱크) + 어린이박물관', note: '야외 30분은 방한 필수' },
        { t: '16:40', p: 'hikr', act: 'K-pop 뮤직비디오 촬영 체험(무료)', note: '중2 하이라이트. 촬영본 QR 저장' },
        { t: '18:30', p: 'gwangjang', act: '빈대떡·마약김밥·육회 저녁', note: '현금 소액 준비, 붐비면 서서 먹기' },
        { t: '19:50', p: 'gwanghwamun_sq', dur: 50, act: '청계천 → 광화문광장 야경 산책', note: '빛초롱축제 연장 여부 확인. 추우면 청계천만' }
      ],
      d2: [
        { t: '09:40', p: 'assembly', dur: 80, act: '10:00 회차 본회의장 참관 (의장석·전자투표 체험)', note: '★ 전원 신분증. 10분 전 접수. 예약 90일 전 오픈' },
        { t: '11:15', p: 'kbson', act: '방송국 견학 (앵커 체험)', note: '5일 전 예약 필수. 국회에서 도보 15분' },
        { t: '12:45', p: 'hyundai_food', act: '더현대 지하 식품관 점심 + 사운즈포레스트', note: '중2 팝업 구경 30분 허용' },
        { t: '14:40', p: 'deoksu', act: '덕수궁 석조전·돌담길 산책', note: '페인터즈 전용관 도보 5분' },
        { t: '16:10', title: '정동 카페 휴식', dur: 35, kind: 'rest', act: '공연 전 화장실·간식', note: '' },
        { t: '17:00', p: 'painters', act: '17:00 회차 관람 (75분)', note: '2027.1 연장 확인 후 예매. 대안: 난타 20:00' },
        { t: '18:40', p: 'myeongdong_gyoja', act: '칼국수·만두 저녁', note: '난타 대안 선택 시 순서 조정' },
        { t: '19:40', p: 'namsan', act: '케이블카 → 자물쇠 광장 야경', note: '전망대 입장은 선택. 명동에서 승강장 도보 15분(오르막)' }
      ],
      d3: [
        { t: '10:00', p: 'palace_museum', dur: 60, act: '왕실 유물로 워밍업', note: '경복궁 주차장 이용' },
        { t: '11:05', p: 'gyeongbok', dur: 105, act: '한복 대여 → 궁 산책 → 수문장 교대식(14:00 대신 10시 회차는 놓침, 사진 위주)', note: '한복 입으면 전원 무료. 겨울 두루마기 추가' },
        { t: '13:00', p: 'tongin', act: '엽전도시락 점심', note: '운영 확인. 대안: 서촌 식당' },
        { t: '14:10', p: 'bukchon', dur: 60, act: '북촌 → 익선동 디저트', note: '초3 지루해하면 익선동 직행' },
        { t: '15:15', title: '잠실 이동', dur: 45, kind: 'move', act: '강변북로 → 올림픽대로', note: '평일 15시 원활' },
        { t: '16:00', p: 'seoulsky', dur: 100, act: '16:45 전후 일몰 → 야경', note: '★ 미세먼지 좋은 날 확정 (당일 아침 판단, 대안: 코엑스 아쿠아리움)' },
        { t: '17:40', p: 'lwmall_food', act: '저녁', note: '' },
        { t: '19:00', p: 'lw_icerink', dur: 90, act: '실내 스케이트 (or 샤롯데 뮤지컬 19:30)', note: '뮤지컬 선택 시 예산 +60만원, 초3 러닝타임 고려' }
      ],
      d4: [
        { t: '09:30', title: '체크아웃', dur: 30, kind: 'custom', act: '짐 싣기', note: '' },
        { t: '10:30', p: 'coex_aqua', dur: 110, act: '아쿠아리움', note: '토요일 오전 개장 직후가 한산' },
        { t: '12:20', p: 'starfield_lib', dur: 30, act: '별마당 인증샷', note: '' },
        { t: '12:50', title: '코엑스몰 점심', dur: 60, kind: 'custom', act: '', note: '' },
        { t: '14:00', title: '대전 귀가 (경부고속도로)', dur: 170, kind: 'move', act: '', note: '★ 토요일 오후 하행 정체 — 14시 전 출발 권장. 17시 대전 도착' }
      ]
    }
  },

  {
    id: 'B', name: 'B. 실내 집중 코스',
    tag: '한파·미세먼지 대비 · 공연/체험형',
    fit: '한파주의보 예보 · 아이들이 놀이·체험을 역사보다 선호할 때',
    summary: '이동 최소화, 하루에 한 권역의 실내 시설에 몰아넣기. 잠실 하루는 롯데월드 or 키자니아 선택.',
    stay: 'stay_lotteworld',
    budgetHint: '5개 안 중 최고가 — 롯데월드 종일권·난타·페인터즈 포함. 놀이 대신 키자니아 분리 시 소폭 절감',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발', dur: 150, kind: 'move', act: '', note: '' },
        { t: '20:30', p: 'stay_lotteworld', dur: 40, act: '체크인', note: '' },
        { t: '21:10', title: '숙소 근처 저녁·휴식', dur: 60, kind: 'rest', act: '용산 아이파크몰 or 배달', note: '다음날 체력 비축' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '상설전시 + 어린이박물관', note: '★ 필수. 수요일 야간개장' },
        { t: '13:20', p: 'nmk_food', act: '점심', note: '' },
        { t: '14:30', p: 'warmemorial', dur: 90, act: '실내 전시 위주', note: '야외 전시는 한파 시 5분 사진만' },
        { t: '16:00', title: '광화문 이동·휴식', dur: 60, kind: 'move', act: '', note: '' },
        { t: '17:00', p: 'painters', act: '17:00 회차', note: '' },
        { t: '18:40', p: 'myeongdong_gyoja', act: '저녁', note: '' },
        { t: '19:40', p: 'myeongdong_st', dur: 50, act: '길거리 간식·캐릭터숍', note: '' }
      ],
      d2: [
        { t: '09:30', title: '잠실 이동', dur: 40, kind: 'move', act: '', note: '' },
        { t: '10:10', p: 'lotteworld', dur: 360, act: '실내 어드벤처 종일 (or 초3은 키자니아 1부, 중2·초6은 롯데월드로 분리)', note: '★ 선택 1: 전원 롯데월드 / 선택 2: 키자니아(초3+엄마) + 롯데월드(중2·초6+아빠)' },
        { t: '16:30', p: 'seoulsky', dur: 90, act: '일몰·야경', note: '롯데월드에서 도보 5분' },
        { t: '18:10', p: 'lwmall_food', act: '저녁', note: '' },
        { t: '19:30', title: '숙소 복귀', dur: 40, kind: 'move', act: '', note: '체력 소진일 — 일찍 쉬기' }
      ],
      d3: [
        { t: '09:00', title: '과천 이동', dur: 40, kind: 'move', act: '', note: '' },
        { t: '09:40', p: 'gwacheon_sci', dur: 240, act: '천체투영관(예약) + 자연사관 + 첨단기술관', note: '"대전에도 있잖아"에 대한 답은 천체투영관. 점심은 과학관 내' },
        { t: '13:50', title: '삼성 이동', dur: 35, kind: 'move', act: '', note: '' },
        { t: '14:30', p: 'coex_aqua', act: '아쿠아리움', note: '' },
        { t: '16:30', p: 'starfield_lib', dur: 30, act: '별마당', note: '' },
        { t: '17:20', title: '명동 이동', dur: 40, kind: 'move', act: '', note: '' },
        { t: '18:00', p: 'myeongdong_gyoja', act: '저녁', note: '하동관(곰탕)은 16시 마감이라 저녁 불가 — 아침·점심에만' },
        { t: '20:00', p: 'nanta', act: '20:00 회차', note: '2027.1 일정 확인 후 예매' }
      ],
      d4: [
        { t: '09:30', title: '체크아웃', dur: 30, kind: 'custom', act: '', note: '' },
        { t: '10:20', p: 'hikr', act: 'K-pop 촬영 체험', note: '' },
        { t: '12:10', p: 'ddp', dur: 50, act: '건축·전시', note: '' },
        { t: '13:10', p: 'sindang', act: '즉석떡볶이 점심', note: '' },
        { t: '14:10', title: '대전 귀가', dur: 170, kind: 'move', act: '', note: '토요일 하행 정체 주의 — 가능하면 더 일찍' }
      ]
    }
  },

  {
    id: 'C', name: 'C. 서울 3일 + 강화도 원정',
    tag: '루지 · 북한 조망 · 서해 일몰',
    fit: '몸으로 노는 활동을 좋아하는 아이들 · "평소 못 가는 곳" 우선',
    summary: 'D2 하루를 통째로 강화도에. 남→북 순서(루지→읍내→평화전망대)로 돌고 저녁에 서울 복귀.',
    stay: 'stay_fraser',
    budgetHint: '루지 2회권(15.5만)이 최대 항목. 공연 없이도 만족도 높은 구성',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발', dur: 150, kind: 'move', act: '', note: '' },
        { t: '20:30', p: 'stay_fraser', dur: 40, act: '체크인', note: '' },
        { t: '21:25', p: 'nodeul', dur: 30, act: '한강 야경', note: '' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '사유의 방 → 실감영상관 → 어린이박물관(예약 회차)', note: '수요일 야간개장' },
        { t: '13:20', p: 'nmk_food', act: '점심', note: '' },
        { t: '14:30', p: 'warmemorial', dur: 90, act: '', note: '' },
        { t: '16:20', p: 'hikr', act: 'K-pop 촬영', note: '' },
        { t: '18:00', p: 'gwangjang', act: '저녁', note: '' },
        { t: '19:20', p: 'gwanghwamun_sq', dur: 50, act: '야경', note: '' }
      ],
      d2: [
        { t: '08:20', title: '강화 이동 (올림픽대로 → 김포한강로 → 초지대교)', dur: 90, kind: 'move', act: '', note: '★ 출근시간 겹침 — 8:20 전 출발. 강화 남단 루지까지 약 1시간 30분' },
        { t: '10:00', p: 'gh_luge', act: '루지 2회 + 곤돌라', note: '오전 한산. 장갑·귀마개' },
        { t: '12:35', p: 'gh_jeondeung', dur: 45, act: '전등사 산책', note: '피곤하면 생략하고 바로 점심' },
        { t: '14:00', p: 'ganghwa_food', act: '읍내 점심', note: '전등사→읍내 약 40분' },
        { t: '15:40', p: 'gh_peace', dur: 50, act: '북한 마을 조망 (입장 16:30 마감)', note: '★ 읍내→전망대 30분. 시간 남으면 소창체험관(17시 마감, 무료)을 점심 뒤에 20분 끼우기. 대안: 동막해변 일몰(남단)' },
        { t: '17:00', p: 'gh_joyang', dur: 40, act: '조양방직 카페에서 몸 녹이기', note: '중2 사진 스팟' },
        { t: '17:40', title: '서울 복귀', dur: 80, kind: 'move', act: '', note: '' },
        { t: '19:00', p: 'mapo_galbi', act: '돼지갈비 저녁', note: '강화→마포 진입로에 위치' }
      ],
      d3: [
        { t: '09:40', p: 'assembly', dur: 80, act: '10:00 참관', note: '신분증' },
        { t: '11:15', p: 'kbson', act: '', note: '' },
        { t: '12:45', p: 'hyundai_food', act: '점심', note: '' },
        { t: '14:40', p: 'gyeongbok', dur: 100, act: '한복 + 궁 산책 (입장 16시 마감 전)', note: '여의도→경복궁 약 30분' },
        { t: '16:30', p: 'bukchon', dur: 60, act: '북촌·익선동', note: '' },
        { t: '17:50', p: 'myeongdong_gyoja', act: '이른 저녁', note: '' },
        { t: '19:00', p: 'namsan', dur: 90, act: '야경', note: '공연을 넣고 싶으면 남산 대신 난타 20:00 (명동교자 도보 3분). 둘 다는 무리' }
      ],
      d4: [
        { t: '09:30', title: '체크아웃', dur: 30, kind: 'custom', act: '', note: '' },
        { t: '10:30', p: 'seoulsky', dur: 80, act: '낮 전망', note: '' },
        { t: '12:00', p: 'lwmall_food', act: '점심', note: '' },
        { t: '13:30', title: '대전 귀가', dur: 170, kind: 'move', act: '', note: '잠실 → 경부 진입 쉬움' }
      ]
    }
  },

  {
    id: 'D', name: 'D. 서울 3일 + 인천 원정',
    tag: '차이나타운 · 월미바다열차 · 세계문자박물관',
    fit: '먹거리·사진·박물관 골고루 · 야외 활동 부담 줄이고 싶을 때',
    summary: '송도(실내 박물관) → 차이나타운(점심) → 월미도(열차) 순으로 실내·실외 교대. 강화보다 이동이 짧고 한파에 유연.',
    stay: 'stay_fraser',
    budgetHint: '무료 박물관 비중 높음 — 서울스카이·아쿠아리움이 절반 이상',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발', dur: 150, kind: 'move', act: '', note: '' },
        { t: '20:30', p: 'stay_fraser', dur: 40, act: '체크인', note: '' },
        { t: '21:25', p: 'nodeul', dur: 30, act: '한강 야경', note: '' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '사유의 방 → 실감영상관 → 어린이박물관(예약 회차)', note: '' },
        { t: '13:20', p: 'nmk_food', act: '점심', note: '' },
        { t: '14:30', p: 'warmemorial', dur: 90, act: '', note: '' },
        { t: '16:20', p: 'hikr', act: '', note: '' },
        { t: '18:00', p: 'gwangjang', act: '저녁', note: '' },
        { t: '19:30', p: 'plaza_skate', act: '서울광장 야간 스케이트 (1,000원)', note: '26-27 시즌 운영 확인. 장갑 필수. 대안: 청계천 산책' }
      ],
      d2: [
        { t: '08:40', title: '송도 이동 (올림픽대로 → 제2경인)', dur: 70, kind: 'move', act: '', note: '' },
        { t: '10:00', p: 'ic_letters', act: '문자박물관 + 어린이체험실(예약)', note: '' },
        { t: '11:40', p: 'ic_centralpark', dur: 30, act: '센트럴파크 사진', note: '바람 강하면 생략' },
        { t: '12:30', title: '차이나타운 이동', dur: 30, kind: 'move', act: '', note: '' },
        { t: '13:00', p: 'chinatown_food', act: '짜장면 점심', note: '' },
        { t: '14:10', p: 'ic_chinatown', dur: 80, act: '삼국지 벽화 → 동화마을 → 개항장', note: '' },
        { t: '15:40', p: 'ic_wolmi', dur: 80, act: '월미바다열차 1바퀴(40분) + 월미공원', note: '동절기 시간표 확인' },
        { t: '17:10', title: '서울 복귀', dur: 70, kind: 'move', act: '', note: '' },
        { t: '18:30', p: 'noryangjin', act: '수산시장 저녁 (or 마포갈비)', note: '회 안 먹는 아이 있으면 마포갈비' }
      ],
      d3: [
        { t: '10:00', p: 'palace_museum', dur: 60, act: '', note: '' },
        { t: '11:05', p: 'gyeongbok', dur: 105, act: '한복', note: '' },
        { t: '13:00', p: 'tongin', act: '엽전도시락', note: '' },
        { t: '14:10', p: 'bukchon', dur: 60, act: '', note: '' },
        { t: '15:20', title: '잠실 이동', dur: 45, kind: 'move', act: '', note: '' },
        { t: '16:10', p: 'seoulsky', dur: 100, act: '일몰·야경', note: '' },
        { t: '18:00', p: 'lwmall_food', act: '저녁', note: '' },
        { t: '19:30', p: 'lw_icerink', dur: 90, act: '실내 스케이트 (D1에 서울광장 탔으면 샤롯데 뮤지컬 or 몰 자유시간)', note: '' }
      ],
      d4: [
        { t: '09:30', title: '체크아웃', dur: 30, kind: 'custom', act: '', note: '' },
        { t: '10:30', p: 'coex_aqua', dur: 110, act: '', note: '국회 참관은 1/23(넷째 토) 미운영이라 이 플랜에서는 제외 — 평일에 넣고 싶으면 D3 오전과 교체' },
        { t: '12:30', title: '코엑스 점심', dur: 60, kind: 'custom', act: '', note: '' },
        { t: '13:40', title: '대전 귀가', dur: 170, kind: 'move', act: '', note: '' }
      ]
    }
  },

  {
    id: 'E', name: 'E. 역사·과학 심화 코스',
    tag: '파주 DMZ · 과천과학관 · 청와대',
    fit: '중2·초6이 역사·과학에 관심 · 교과 연계 여행을 원할 때',
    summary: 'D2 오전 임진각 곤돌라(민통선) → 파주 출판도시, D3 과천과학관 반일. 초3을 위해 매일 "놀이 슬롯" 하나씩 배치.',
    stay: 'stay_fraser',
    budgetHint: '5개 안 중 최저가 — 국립시설·무료 체험 중심',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발', dur: 150, kind: 'move', act: '', note: '' },
        { t: '20:30', p: 'stay_fraser', dur: 40, act: '체크인', note: '' },
        { t: '21:25', p: 'nodeul', dur: 30, act: '한강 야경', note: '' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '사유의 방 → 실감영상관 → 어린이박물관(예약 회차)', note: '' },
        { t: '13:20', p: 'nmk_food', act: '점심', note: '' },
        { t: '14:30', p: 'seodaemun', act: '독립운동 현장', note: '17시 마감이라 전쟁기념관보다 먼저. 초3 사전 설명' },
        { t: '16:20', p: 'warmemorial', dur: 90, act: '실내 전시 위주 (18시 마감)', note: '' },
        { t: '18:20', p: 'gwangjang', act: '저녁', note: '' },
        { t: '19:40', p: 'plaza_skate', act: '초3 놀이 슬롯 — 야간 스케이트', note: '운영 확인' }
      ],
      d2: [
        { t: '08:30', title: '파주 이동 (자유로)', dur: 60, kind: 'move', act: '', note: '자유로 정체 적음' },
        { t: '09:40', p: 'pj_imjingak', act: '평화곤돌라 → 캠프 그리브스 → 평화누리', note: '★ 신분증. 바람의 언덕 방한' },
        { t: '12:50', p: 'pj_heyri', act: '헤이리 점심 + 초3용 체험 박물관 1곳', note: '임진각→헤이리 약 35분' },
        { t: '15:05', p: 'pj_forest', act: '지혜의숲', note: '' },
        { t: '16:05', title: '서울 복귀', dur: 60, kind: 'move', act: '', note: '자유로 → 강변북로' },
        { t: '17:05', p: 'hikr', dur: 80, act: 'K-pop 촬영 (놀이 슬롯)', note: '' },
        { t: '18:45', p: 'sindang', act: '떡볶이 저녁', note: '' },
        { t: '19:55', p: 'ddp', dur: 45, act: 'DDP 외관·서울라이트 야경', note: '실내 전시는 20시 마감 — 외부 미디어파사드 위주' }
      ],
      d3: [
        { t: '09:00', title: '과천 이동', dur: 40, kind: 'move', act: '', note: '' },
        { t: '09:40', p: 'gwacheon_sci', dur: 240, act: '천체투영관 + 전시관 (점심 내부)', note: '천체투영관 예약' },
        { t: '14:30', p: 'gm_cave', act: '광명동굴 미디어아트 (놀이 슬롯)', note: '과천 → 광명 약 40분. 대안: 서울대공원(날씨 좋을 때)' },
        { t: '16:30', title: '명동 이동', dur: 60, kind: 'move', act: '', note: '퇴근 시간 진입 — 60분 잡음' },
        { t: '17:30', p: 'myeongdong_gyoja', act: '이른 저녁', note: '' },
        { t: '18:40', p: 'namsan', act: '야경', note: '' }
      ],
      d4: [
        { t: '09:00', title: '체크아웃', dur: 30, kind: 'custom', act: '', note: '' },
        { t: '09:50', p: 'bluehouse', act: '청와대 관람 (예약 가능 시) → 불가 시 경복궁+고궁박물관', note: '★ 개방 정책 확인. 신분증' },
        { t: '12:00', p: 'tongin', act: '엽전도시락', note: '' },
        { t: '13:20', title: '대전 귀가', dur: 170, kind: 'move', act: '', note: '' }
      ]
    }
  },

  {
    id: 'F', name: 'F. 스포츠·K-컬처 + 귀가길 수원',
    tag: 'LCK · 프로농구 · 기술체험관 · 수원화성',
    fit: '중2·초6이 게임·스포츠·전자기기에 열광할 때 · 귀가길도 여행으로 쓰고 싶을 때',
    summary: '무료 기술체험관(티움·딜라이트)과 경기 관람(롤파크·잠실 농구)을 축으로, 마지막 날은 경부고속도로 길목의 수원화성에서 마무리. 경기 일정은 12월 확정이라 "슬롯"으로 잡아둠.',
    stay: 'stay_fraser',
    budgetHint: '경기 티켓은 저렴하고 체험관은 무료 — 서울스카이·아쿠아리움이 비용의 절반',
    days: {
      d0: [
        { t: '18:00', title: '대전 출발', dur: 150, kind: 'move', act: '', note: '' },
        { t: '20:30', p: 'stay_fraser', dur: 40, act: '체크인', note: '' },
        { t: '21:30', p: 'yongridan', dur: 50, act: '숙소 근처 늦은 저녁·디저트', note: '피곤하면 배달로 대체' }
      ],
      d1: [
        { t: '10:00', p: 'nmk', dur: 200, act: '사유의 방 → 실감영상관 → 어린이박물관(예약 회차)', note: '★ 필수. 수요일 야간개장' },
        { t: '13:20', p: 'nmk_food', act: '점심', note: '' },
        { t: '14:30', p: 'tum', act: '미래관 투어 (예약 회차)', note: '평일만 운영. 을지로입구역' },
        { t: '16:10', p: 'hikr', dur: 80, act: 'K-pop 촬영 체험', note: '티움에서 도보 5분' },
        { t: '17:30', p: 'lolpark', act: 'LCK 경기 관람 (경기 있는 날)', note: '★ 2027.1 일정 12월 확인. 경기 없으면 페인터즈 17:00로 대체' },
        { t: '20:40', p: 'gwangjang', dur: 60, act: '늦은 저녁', note: '롤파크에서 도보 15분' }
      ],
      d2: [
        { t: '09:40', p: 'assembly', dur: 80, act: '10:00 회차 참관', note: '신분증' },
        { t: '11:15', p: 'kbson', act: '방송국 견학', note: '' },
        { t: '12:45', p: 'hyundai_food', act: '점심 + 팝업', note: '' },
        { t: '14:40', p: 'gyeongbok', dur: 100, act: '한복 + 궁 산책', note: '여의도→경복궁 30분' },
        { t: '16:30', p: 'bukchon', dur: 60, act: '북촌 → 익선동', note: '' },
        { t: '18:00', p: 'dakhanmari', act: '닭한마리 저녁', note: '' },
        { t: '19:30', p: 'ddp', dur: 45, act: 'DDP 야경', note: '' }
      ],
      d3: [
        { t: '10:00', p: 'dlight', act: '갤럭시·디스플레이 체험', note: '주차 1시간 무료' },
        { t: '11:20', p: 'coex_aqua', act: '아쿠아리움', note: '' },
        { t: '13:20', title: '코엑스몰 점심', dur: 60, kind: 'custom', act: '', note: '' },
        { t: '14:30', p: 'starfield_lib', dur: 30, act: '별마당', note: '' },
        { t: '15:10', title: '잠실 이동', dur: 25, kind: 'move', act: '', note: '' },
        { t: '15:40', p: 'seoulsky', dur: 100, act: '일몰·야경', note: '' },
        { t: '17:30', p: 'lwmall_food', act: '저녁', note: '' },
        { t: '19:00', p: 'kbl', act: '프로농구 19:00 (잠실 홈경기일)', note: '★ 홈경기 없으면 아이스링크 or 샤롯데 뮤지컬' }
      ],
      d4: [
        { t: '08:30', title: '체크아웃', dur: 30, kind: 'custom', act: '', note: '' },
        { t: '09:00', title: '수원 이동 (경부고속도로)', dur: 60, kind: 'move', act: '', note: '토요일 오전 하행 원활' },
        { t: '10:00', p: 'suwon_fortress', act: '행궁 → 화성어차 → 국궁 체험', note: '대안: 에버랜드 종일(18시 출발 → 20시 대전)' },
        { t: '12:40', p: 'suwon_chicken', act: '통닭 점심', note: '' },
        { t: '14:00', title: '대전 귀가', dur: 100, kind: 'move', act: '', note: '수원 → 대전 1시간 40분' }
      ]
    }
  }
];
