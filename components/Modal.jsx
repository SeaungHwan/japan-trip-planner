"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "@/components/IconButton";
import { SKY } from "@/lib/theme";

// SpotsPanel/FoodsPanel/SettlementModal/DayDetailModal/MemoModal이 각자 따로 구현하던
// "배경 오버레이 + 흰 카드 + 스크롤 영역 + 제목줄(아이콘+제목+닫기)" 뼈대를 하나로 모읍니다.
// 배경 클릭 시 닫히고, 카드 클릭은 stopPropagation으로 막아 배경 클릭과 구분합니다.
//
// 닫을 때 바로 언마운트하면 페이드아웃이 재생될 시간이 없어서, 먼저 closing 상태로
// 페이드아웃 애니메이션만 틀고, 그 애니메이션이 끝난 뒤(onAnimationEnd)에야 실제
// onClose를 호출해 부모가 언마운트하게 합니다. e.target === e.currentTarget으로
// 안쪽 카드의 애니메이션이 버블링돼 오는 걸 걸러, 배경 자신의 애니메이션이 끝났을
// 때만 반응합니다.
export default function Modal({ icon: Icon, title, onClose, headerExtra, minHeight, children }) {
  const [closing, setClosing] = useState(false);

  function requestClose() {
    setClosing(true);
  }

  function handleBackdropAnimationEnd(e) {
    if (closing && e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,42,61,0.5)] ${closing ? "modal-backdrop-out" : "modal-backdrop-in"}`}
      onClick={requestClose}
      onAnimationEnd={handleBackdropAnimationEnd}
    >
      <div
        className={`w-full max-w-sm rounded-2xl max-h-[85vh] flex flex-col overflow-hidden bg-white ${
          minHeight ? "" : "min-h-[30vh]"
        } ${closing ? "modal-card-out" : "modal-card-in"}`}
        // minHeight만 주면 카드 자체는 그 높이만큼 늘어나지만, 크롬은 min-height만으로는
        // 이 카드를 "정해진 높이"로 안 쳐서, 내용물(children) 쪽에서 h-full로 바닥까지
        // 채우려 해도 퍼센트 높이가 안 먹힙니다(명시적 height가 있어야 자식의 h-full이
        // 그 값을 기준으로 계산됨). minHeight를 쓰는 곳(MemoModal)은 애초에 카드가 항상
        // 그 높이를 유지하길 원하므로 height도 같이 줍니다. minHeight를 안 주는 나머지
        // 모달들은 대신 min-h-[30vh] 클래스로 "최소 높이"만 보장합니다(내용이 더 길면
        // 그만큼 자연스럽게 늘어남 — max-h-[85vh]까지).
        style={{ minHeight, height: minHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-3 shrink-0">
          <span className="text-[15px] flex items-center gap-1.5 text-ink font-bold">
            {Icon && <Icon size={16} color={SKY} />} {title}
          </span>
          <span className="flex items-center gap-1">
            {headerExtra}
            <IconButton onClick={requestClose} ariaLabel="닫기">
              <X size={23} color="#5B7A90" />
            </IconButton>
          </span>
        </div>
        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
}
