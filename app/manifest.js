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
    // 원본이 256x256 한 장뿐이라 192/512 둘 다 이 파일을 씁니다(512는 약간 확대돼
    // 보일 수 있음). 아이콘 그림이 가장자리까지 꽉 차 있어서 안드로이드가 원형/사각형
    // 등으로 잘라내는 maskable 용도로는 안 맞아 purpose는 "any"만 둡니다.
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
