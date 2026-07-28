"use client";

import { useState } from "react";

// 위키피디아/Pixabay에서 받아오는 사진은 도착 전까지 빈 자리라 로딩이 느리게
// 느껴지기 쉬워서, 로드 전엔 펄스 스켈레톤을 보여주고 로드되면 페이드인합니다.
// src가 바뀔 때 부모가 key={src}를 넘겨주면 새로 마운트되어 스켈레톤이 다시 뜹니다.
export default function LazyImage({ src, alt = "", className = "", style }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={`relative block overflow-hidden ${className}`} style={style}>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-sky-border" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </span>
  );
}
