"use client";

// 아이콘만 있는 버튼들이 패딩 없이 아이콘 자체(12~15px)를 탭 영역으로 쓰고 있어서
// 모바일에서 오탭이 잦았습니다. padding(+8px)과 그만큼의 음수 margin(-8px)을 같이 줘서,
// 실제 탭 가능 영역은 사방으로 8px씩 넓히면서도 형제 요소와의 시각적 간격(레이아웃이
// 차지하는 크기)은 그대로 유지합니다 — 아이콘 크기나 버튼 배치는 전혀 안 바뀌고
// 눈에 안 보이는 여백만 넓어집니다.
export default function IconButton({ onClick, ariaLabel, children, className = "", disabled, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`inline-flex items-center justify-center shrink-0 p-2 -m-2 ${className}`}
    >
      {children}
    </button>
  );
}
