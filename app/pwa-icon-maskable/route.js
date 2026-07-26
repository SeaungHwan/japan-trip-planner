import { ImageResponse } from "next/og";

// 안드로이드 적응형 아이콘(maskable)은 런처가 원형/둥근사각형 등으로 임의로 잘라내므로,
// 실제 그림은 캔버스 중앙의 안전 영역(약 80%) 안에만 들어가게 여백을 넉넉히 둡니다.
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
        }}
      >
        <div style={{ display: "flex", fontSize: 200 }}>✈️</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
