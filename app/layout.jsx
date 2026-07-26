import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

export const metadata = {
  title: "여행",
  description: "여행 플래너 — 대중교통 · 렌트카 코스, 항공편 정보, 지도",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "여행 플래너",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0EA5E9",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>

        <link rel="stylesheet" href="/font/Pretendard/fonts.css" />
        <link rel="stylesheet" href="/font/Sora/fonts.css" />
        <link rel="stylesheet" href="/font/RimixIcon/remixicon.css" />
      </head>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
