"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";

const SKY = "#0EA5E9";

function formatDate(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`;
}

// Planner의 맨 위 날짜 표시도 지역 날짜가 있으면 그걸 우선해서 보여줘야 해서 같이 씁니다.
export function formatRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate) return formatDate(startDate);
  return `${formatDate(startDate)}—${formatDate(endDate)}`;
}

// 지역별 날짜 오버라이드 버튼. 맨 위 트립 날짜("9.18 — 9.22") 바로 옆에 두는 버튼이라
// RegionHeader가 아니라 Planner에서 그 날짜 텍스트 옆에 직접 렌더링합니다.
export default function RegionDateButton({ region, canEdit, onSaveDates }) {
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  if (!canEdit) return null;

  function openDateModal() {
    setStartDate(region.startDate || "");
    setEndDate(region.endDate || "");
    setClosing(false);
    setDateModalOpen(true);
  }

  function requestCloseModal() {
    setClosing(true);
  }

  function handleBackdropAnimationEnd(e) {
    if (closing && e.target === e.currentTarget) setDateModalOpen(false);
  }

  function submitDates() {
    onSaveDates(startDate || null, endDate || null);
    requestCloseModal();
  }

  return (
    <>
      <button onClick={openDateModal} aria-label="지역 날짜 수정" className="flex items-center gap-1">
        <CalendarDays size={14} color="#94A9B8" />
      </button>

      {dateModalOpen &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? "modal-backdrop-out" : "modal-backdrop-in"}`}
            style={{ background: "rgba(15,42,61,0.5)" }}
            onAnimationEnd={handleBackdropAnimationEnd}
          >
            <div className={`w-full max-w-sm rounded-2xl p-4 ${closing ? "modal-card-out" : "modal-card-in"}`} style={{ background: "#FFFFFF" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                  {region.kr} 날짜
                </span>
                <button onClick={requestCloseModal}>
                  <X size={18} color="#5B7A90" />
                </button>
              </div>
              <p className="text-[12px] mb-2" style={{ color: "#94A9B8" }}>
                비워두면 여행 전체 날짜를 그대로 씁니다. 이 지역만 일정이 다르면 여기서 따로 지정하세요.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStartDate(value);
                    // 종료일을 아직 안 골랐으면, 다음에 열 때 오늘이 아니라 이 날짜부터
                    // 보이도록 시작일과 같은 값으로 미리 채워둡니다.
                    if (!endDate) setEndDate(value);
                  }}
                  className="flex-1 min-w-0 text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <span className="text-sm" style={{ color: "#94A9B8" }}>
                  —
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 min-w-0 text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="flex-1 text-sm rounded-lg py-2"
                  style={{ border: "1px solid #BAE6FD", color: "#5B7A90", fontWeight: 700 }}
                >
                  비우기
                </button>
                <button
                  onClick={submitDates}
                  className="flex-1 text-sm rounded-lg py-2"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
