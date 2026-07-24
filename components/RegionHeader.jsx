"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, CalendarDays, X } from "lucide-react";
import { getIcon } from "@/data/icons";
import Feedback from "@/components/Feedback";

const SKY = "#0EA5E9";

function formatDate(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`;
}

function formatRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate) return formatDate(startDate);
  return `${formatDate(startDate)}—${formatDate(endDate)}`;
}

export default function RegionHeader({ region, onDelete, canEdit, onSaveDates }) {
  const Icon = getIcon(region.icon);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function openDateModal() {
    setStartDate(region.startDate || "");
    setEndDate(region.endDate || "");
    setDateModalOpen(true);
  }

  function submitDates() {
    onSaveDates(startDate || null, endDate || null);
    setDateModalOpen(false);
  }

  return (
    <div className="mb-3 anim-fadeup" key={region.id}>
      <div className="flex items-center gap-2">
        <Icon size={18} color={SKY} />
        <span className="text-lg serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          {region.kr}
        </span>
        <span className="text-xs" style={{ color: "#94A9B8" }}>
          {region.jp}
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {canEdit && (
            <button onClick={openDateModal} aria-label="지역 날짜 수정" className="flex items-center gap-1">
              <CalendarDays size={14} color="#94A9B8" />
              {region.startDate && (
                <span className="text-[11px]" style={{ color: "#94A9B8" }}>
                  {formatRange(region.startDate, region.endDate)}
                </span>
              )}
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} aria-label="지역 삭제" className="shrink-0">
              <Trash2 size={15} color="#94A9B8" />
            </button>
          )}
        </div>
      </div>
      {region.note && (
        <p className="text-[13px] mt-1" style={{ color: "#5B7A90" }}>
          {region.note}
        </p>
      )}
      <Feedback targetKey={`region:${region.id}`} />

      {dateModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,42,61,0.5)" }}
          >
            <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "#FFFFFF" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                  {region.kr} 날짜
                </span>
                <button onClick={() => setDateModalOpen(false)}>
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
                  onChange={(e) => setStartDate(e.target.value)}
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
    </div>
  );
}
