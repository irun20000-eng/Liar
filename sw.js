// 라이어 게임 서비스 워커
// 전략: 같은 출처(앱 파일)는 "네트워크 우선" → 온라인이면 항상 최신,
//       오프라인이면 캐시로 폴백. (수정사항이 바로 반영되도록)
const CACHE = "liar-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./words.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 외부 리소스(폰트 등)는 브라우저 기본 처리에 맡김
  if (url.origin !== location.origin) return;

  // 네트워크 우선: 성공하면 캐시 갱신, 실패(오프라인)하면 캐시 → 없으면 index
  e.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
