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
        className={`w-full max-w-sm rounded-2xl max-h-[85vh] flex flex-col overflow-hidden bg-white ${closing ? "modal-card-out" : "modal-card-in"}`}
        style={{ minHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-3 shrink-0">
          <span className="text-[15px] flex items-center gap-1.5 text-ink font-bold">
            {Icon && <Icon size={16} color={SKY} />} {title}
          </span>
          <span className="flex items-center gap-1">
            {headerExtra}
            <IconButton onClick={requestClose} ariaLabel="닫기">
              <X size={18} color="#5B7A90" />
            </IconButton>
          </span>
        </div>
        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
}
