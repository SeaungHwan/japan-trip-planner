import "./globals.css";

export const metadata = {
  title: "여행",
  description: "여행 플래너 — 대중교통 · 렌트카 코스, 항공편 정보, 지도",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* globals.css의 @import 체인 대신 여기서 병렬로 받아옵니다: @import는 메인
            스타일시트가 먼저 도착해야 그다음에야 순서대로 요청을 시작해서 폰트가
            늦게 뜨는 원인이었습니다(font-display:swap이라 글자는 바로 보이지만
            폰트 자체는 늦게 적용됨). */}
        <link rel="stylesheet" href="/font/Pretendard/fonts.css" />
        <link rel="stylesheet" href="/font/Sora/fonts.css" />
        <link rel="stylesheet" href="/font/RimixIcon/remixicon.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
