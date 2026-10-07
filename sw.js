// 只快取 app 本體，讓沒網路時打得開。
// 名片資料不在這裡快取——那由 index.html 自己存在 localStorage，
// 因為它需要在「有網路但伺服器連不上」時也能用舊資料。
const CACHE = "mingpian-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // 只清掉舊版的「本體」快取。原本是清掉所有名字不等於 CACHE 的快取，
      // 那會連 index.html 自己存的名片原圖快取（mingpian-img-*）一起砍掉——
      // service worker 每次改版就把使用者辛苦下載的圖全部清空。
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("mingpian-shell-") && k !== CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API 請求永遠走網路，絕不從快取回應。
  // 快取名片資料會讓人看到舊的備註卻以為是最新的。
  if (url.pathname.includes("/webhook/")) return;

  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // 先拿網路的，失敗才用快取；成功就順便更新快取。
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
