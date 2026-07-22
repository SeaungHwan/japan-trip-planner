"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, X } from "lucide-react";

const SKY = "#0EA5E9";

export default function TripSwitcher({ trips, activeTripId, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  function close() {
    setOpen(false);
    setShowCreate(false);
  }

  function submitCreate() {
    if (!title.trim()) return;
    onCreate(title.trim(), subtitle.trim());
    setTitle("");
    setSubtitle("");
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
                <button
                  key={t.id}
                  onClick={() => {
                    onSelect(t.id);
                    close();
                  }}
                  className="text-left rounded-lg px-3 py-2 text-sm"
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
              ))}
            </div>

            {showCreate ? (
              <div className="flex flex-col gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="여행 이름 (필수, 예: 제주도 여행)"
                  autoFocus
                  className="w-full text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="날짜/부제 (선택, 예: 10.1 — 10.5)"
                  className="w-full text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <button
                  onClick={submitCreate}
                  className="w-full text-sm rounded-lg py-2"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  만들기
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
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
