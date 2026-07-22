import "./globals.css";

export const metadata = {
  title: "일본 소도시 여행",
  description: "9.18~9.22 일본 소도시 여행 플래너 — 대중교통 · 렌트카 코스, 항공편 정보, 지도",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
