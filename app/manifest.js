// Next.js가 이 파일을 자동으로 /manifest.webmanifest로 서빙하고 <head>에
// <link rel="manifest">도 알아서 넣어줍니다 — layout.jsx에서 따로 연결할 필요 없습니다.
export default function manifest() {
  return {
    name: "여행 플래너",
    short_name: "여행 플래너",
    description: "여행 플래너 — 대중교통 · 렌트카 코스, 항공편 정보, 지도",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#0EA5E9",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
