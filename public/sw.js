// 안드로이드에서 "앱 설치" 배너가 뜨려면 fetch 핸들러가 있는 서비스워커 등록이
// 필요합니다. 이 앱은 Supabase 실시간 데이터에 강하게 의존해서, 응답을 캐싱하면
// 오히려 오래된 일정/댓글이 보일 위험이 있습니다. 그래서 일부러 아무것도 캐싱하지
// 않고 그대로 네트워크로 통과시키는 최소 구현만 둡니다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // 아무 것도 하지 않음: 브라우저 기본 네트워크 처리를 그대로 씁니다.
});
