"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Pencil, X } from "lucide-react";

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

export default function TripSwitcher({ trips, activeTripId, onSelect, onSave }) {
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
    setStartDate("");
    setEndDate("");
  }

  function submit() {
    if (!title.trim()) return;
    onSave(editingId || null, title.trim(), formatRange(startDate, endDate));
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
              {trips.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onSelect(t.id);
                      close();
                    }}
                    className="flex-1 min-w-0 text-left rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: t.id === activeTripId ? SKY : "#F0F9FF",
                      color: t.id === activeTripId ? "#FFFFFF" : "#0F2A3D",
                      fontWeight: t.id === activeTripId ? 700 : 500,
                      border: "1px solid #BAE6FD",
                    }}
                  >
                    {t.title}
                    {t.subtitle && (
                      <span className="block text-[11px]" style={{ opacity: 0.8 }}>
                        {t.subtitle}
                      </span>
                    )}
                  </button>
                  <button onClick={() => startEdit(t)} aria-label="여행 정보 수정" className="shrink-0">
                    <Pencil size={14} color="#5B7A90" />
                  </button>
                </div>
              ))}
            </div>

            {editingId !== undefined ? (
              <div className="flex flex-col gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="여행 이름 (필수, 예: 제주도 여행)"
                  autoFocus
                  className="w-full text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <div className="flex items-center gap-2">
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
                <button
                  onClick={submit}
                  className="w-full text-sm rounded-lg py-2"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  {editingId ? "저장" : "만들기"}
                </button>
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
