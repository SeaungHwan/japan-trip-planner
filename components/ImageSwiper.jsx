"use client";

import { useRef, useState } from "react";

// CSS 스크롤 스냅만으로 스와이프를 구현합니다(별도 라이브러리 없이 네이티브 터치
// 스와이프가 그대로 동작). 스크롤 위치로 현재 페이지를 계산해 점 인디케이터만 JS로 갱신합니다.
export default function ImageSwiper({ images, height = 140 }) {
  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="relative shrink-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto no-scrollbar"
        style={{ scrollSnapType: "x mandatory", height }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="w-full shrink-0"
            style={{ height, objectFit: "cover", scrollSnapAlign: "start" }}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ width: 5, height: 5, background: i === index ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
