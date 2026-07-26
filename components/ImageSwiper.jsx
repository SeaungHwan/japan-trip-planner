"use client";

// CSS 스크롤 스냅만으로 스와이프를 구현합니다(별도 라이브러리 없이 네이티브 터치
// 스와이프가 그대로 동작). 한 화면에 3장씩 보이고, 그보다 많으면 옆으로 스크롤해서 봅니다.
// 4장 이상일 때는 다음 사진이 옆에 살짝 걸쳐 보이게 폭을 줄여서, 더 있다는 걸 스크롤 없이도 알 수 있게 합니다.
export default function ImageSwiper({ images, height = 100 }) {
  if (images.length === 0) return null;
  const hasMore = images.length > 3;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar" style={{ scrollSnapType: "x proximity" }}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="rounded-lg shrink-0"
          style={{ width: hasMore ? "29%" : "calc((100% - 16px) / 3)", height, objectFit: "cover", scrollSnapAlign: "start" }}
        />
      ))}
    </div>
  );
}
