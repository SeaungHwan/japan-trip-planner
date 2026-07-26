"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Pencil, Trash2, X } from "lucide-react";

const SKY = "#0EA5E9";

function formatDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`;
}

function formatRange(startDate, endDate) {
  if (startDate && endDate) return `${formatDate(startDate)} — ${formatDate(endDate)}`;
  if (startDate) return formatDate(startDate);
  return "";
}

export default function TripSwitcher({ trips, activeTripId, onSelect, onSave, canDelete, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(undefined); // undefined = create-new mode is hidden, null = creating new, id = editing that trip
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function close() {
    setOpen(false);
    setEditingId(undefined);
  }

  function startCreate() {
    setEditingId(null);
    setTitle("");
    setStartDate("");
    setEndDate("");
  }

  function startEdit(trip) {
    setEditingId(trip.id);
    setTitle(trip.title);
    setStartDate(trip.start_date || "");
    setEndDate(trip.end_date || "");
  }

  function submit() {
    if (!title.trim()) return;
    onSave(editingId || null, title.trim(), formatRange(startDate, endDate), startDate || null, endDate || null);
    close();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs flex items-center gap-1"
        style={{ color: "#5B7A90", fontWeight: 700 }}
      >
        <ChevronDown size={14} /> 다른 여행
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,42,61,0.5)" }}>
          <div className="w-full max-w-sm rounded-2xl p-4 max-h-[80vh] overflow-y-auto" style={{ background: "#FFFFFF" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                여행 목록
              </span>
              <button onClick={close}>
                <X size={18} color="#5B7A90" />
              </button>
            </div>

            <div className="flex flex-col gap-2 mb-3">
              {trips.map((t) => {
                const isActive = t.id === activeTripId;
                const iconColor = isActive ? "#FFFFFF" : "#5B7A90";
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 rounded-lg pl-3 pr-1.5 py-1.5 text-sm"
                    style={{
                      background: isActive ? SKY : "#F0F9FF",
                      border: "1px solid #BAE6FD",
                    }}
                  >
                    <button
                      onClick={() => {
                        onSelect(t.id);
                        close();
                      }}
                      className="flex-1 min-w-0 text-left py-0.5"
                      style={{ color: isActive ? "#FFFFFF" : "#0F2A3D", fontWeight: isActive ? 700 : 500 }}
                    >
                      {t.title}
                      {t.subtitle && (
                        <span className="block text-[11px]" style={{ opacity: 0.8 }}>
                          {t.subtitle}
                        </span>
                      )}
                    </button>
                    <button onClick={() => startEdit(t)} aria-label="여행 정보 수정" className="shrink-0 p-1.5">
                      <Pencil size={14} color={iconColor} />
                    </button>
                    {canDelete?.(t) && (
                      <button onClick={() => onDelete(t)} aria-label="여행 삭제" className="shrink-0 p-1.5">
                        <Trash2 size={14} color={iconColor} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {editingId !== undefined ? (
              <div className="rounded-lg p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
                  여행 이름 (필수)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 제주도 여행"
                  autoFocus
                  className="w-full text-sm rounded px-2 py-1.5 mb-2"
                  style={{ border: "1px solid #BAE6FD" }}
                />

                <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
                  여행 기간 (선택)
                </label>
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
                    onClick={() => setEditingId(undefined)}
                    className="flex-1 text-sm rounded-lg py-2"
                    style={{ border: "1px solid #BAE6FD", color: "#5B7A90", fontWeight: 700 }}
                  >
                    취소
                  </button>
                  <button
                    onClick={submit}
                    className="flex-1 text-sm rounded-lg py-2"
                    style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                  >
                    {editingId ? "저장" : "만들기"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startCreate}
                className="w-full text-xs flex items-center justify-center gap-1 py-2"
                style={{ color: SKY, fontWeight: 700 }}
              >
                <Plus size={13} /> 새 여행 만들기
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
