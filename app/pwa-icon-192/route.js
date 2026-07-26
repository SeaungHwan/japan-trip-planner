import { ImageResponse } from "next/og";

// PWA 매니페스트용 아이콘(192x192). 브라우저 탭 파비콘(app/icon.js)과는 별개로,
// 안드로이드 홈 화면/앱 서랍에 실제로 표시되는 아이콘입니다.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0EA5E9",
          fontSize: 110,
        }}
      >
        ✈️
      </div>
    ),
    { width: 192, height: 192 }
  );
}
