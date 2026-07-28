"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Pencil, Trash2, X } from "lucide-react";
import IconButton from "@/components/IconButton";
import { SKY, SKY_BG, INK } from "@/lib/theme";

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
  const [closing, setClosing] = useState(false);
  const [editingId, setEditingId] = useState(undefined); // undefined = create-new mode is hidden, null = creating new, id = editing that trip
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function openSwitcher() {
    setClosing(false);
    setOpen(true);
  }

  function close() {
    setClosing(true);
  }

  function handleBackdropAnimationEnd(e) {
    if (closing && e.target === e.currentTarget) {
      setOpen(false);
      setEditingId(undefined);
    }
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
        onClick={openSwitcher}
        className="text-xs flex items-center gap-1 text-muted font-bold"
      >
        <ChevronDown size={14} /> 다른 여행
      </button>

      {open && createPortal(
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,42,61,0.5)] ${closing ? "modal-backdrop-out" : "modal-backdrop-in"}`}
          onAnimationEnd={handleBackdropAnimationEnd}
        >
          <div
            className={`w-full max-w-sm rounded-2xl min-h-[30vh] max-h-[80vh] flex flex-col overflow-hidden bg-white ${closing ? "modal-card-out" : "modal-card-in"}`}
          >
            <div className="flex items-center justify-between p-4 pb-3 shrink-0">
              <span className="text-base text-ink font-bold">
                여행 목록
              </span>
              <IconButton onClick={close} ariaLabel="닫기">
                <X size={23} color="#5B7A90" />
              </IconButton>
            </div>

            <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
              <div className="flex flex-col gap-2 mb-3">
                {trips.map((t) => {
                  const isActive = t.id === activeTripId;
                  const iconColor = isActive ? "#FFFFFF" : "#5B7A90";
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 rounded-lg pl-3 pr-1.5 py-1.5 text-sm border border-sky-border"
                      style={{
                        background: isActive ? SKY : SKY_BG,
                      }}
                    >
                      <button
                        onClick={() => {
                          onSelect(t.id);
                          close();
                        }}
                        className="flex-1 min-w-0 text-left py-0.5"
                        style={{ color: isActive ? "#FFFFFF" : INK, fontWeight: isActive ? 700 : 500 }}
                      >
                        {t.title}
                        {t.subtitle && (
                          <span className="block text-[11px] opacity-80">
                            {t.subtitle}
                          </span>
                        )}
                      </button>
                      <IconButton onClick={() => startEdit(t)} ariaLabel="여행 정보 수정">
                        <Pencil size={18} color={iconColor} />
                      </IconButton>
                      {canDelete?.(t) && (
                        <IconButton onClick={() => onDelete(t)} ariaLabel="여행 삭제">
                          <Trash2 size={18} color={iconColor} />
                        </IconButton>
                      )}
                    </div>
                  );
                })}
              </div>

              {editingId !== undefined ? (
                <div className="rounded-lg p-3 bg-slate-bg border border-slate-border">
                  <label className="block text-[12px] mb-1 text-muted">
                    여행 이름 (필수)
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 제주도 여행"
                    autoFocus
                    className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
                  />

                  <label className="block text-[12px] mb-1 text-muted">
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
                      className="flex-1 min-w-0 text-sm rounded px-2 py-1.5 border border-sky-border"
                    />
                    <span className="text-sm text-faint">
                      —
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 min-w-0 text-sm rounded px-2 py-1.5 border border-sky-border"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingId(undefined)}
                      className="flex-1 text-sm rounded-lg py-2 border border-sky-border text-muted font-bold"
                    >
                      취소
                    </button>
                    <button
                      onClick={submit}
                      className="flex-1 text-sm rounded-lg py-2 bg-sky text-white font-bold"
                    >
                      {editingId ? "저장" : "만들기"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startCreate}
                  className="text-xs flex items-center justify-center gap-1 py-2 text-sky font-bold w-auto mx-auto my-0"
                >
                  <Plus size={13} /> 새 여행 만들기
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
