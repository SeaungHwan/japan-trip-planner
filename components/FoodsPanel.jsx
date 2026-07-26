"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { UtensilsCrossed, ChevronRight, X, Plus } from "lucide-react";

const SKY = "#0EA5E9";

// 명소(SpotsPanel)와 같은 모양이지만 위치 데이터가 필요 없어서 이름만 다루는
// 훨씬 단순한 버전입니다(지도 연동 없음).
export default function FoodsPanel({ foods, open, onToggle, canEdit, onAddFood, onDeleteFood }) {
  const [newName, setNewName] = useState("");

  function submitAdd() {
    if (!newName.trim()) return;
    onAddFood?.(newName);
    setNewName("");
  }

  function handleClose() {
    setNewName("");
    onToggle();
  }

  return (
    <>
      <button
        className="w-full rounded-xl mb-4 flex items-center justify-between p-3"
        style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
        onClick={onToggle}
      >
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          <UtensilsCrossed size={14} color={SKY} /> 지역 음식
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[12px]" style={{ color: "#94A9B8" }}>
            {(foods || []).length}
          </span>
          <ChevronRight size={16} color="#5B7A90" />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,42,61,0.5)" }}
            onClick={handleClose}
          >
            <div
              className="w-full max-w-sm rounded-2xl max-h-[85vh] flex flex-col overflow-hidden"
              style={{ background: "#FFFFFF" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[15px] flex items-center gap-1.5" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                    <UtensilsCrossed size={16} color={SKY} /> 지역 음식
                  </span>
                  <button onClick={handleClose} aria-label="닫기">
                    <X size={18} color="#5B7A90" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(foods || []).map((name, i) => (
                    <span
                      key={i}
                      className="text-[12px] pl-2.5 pr-1.5 py-1.5 rounded-full flex items-center gap-1"
                      style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                    >
                      <span>{name}</span>
                      {canEdit && (
                        <button onClick={() => onDeleteFood?.(i)} aria-label="음식 삭제" className="shrink-0">
                          <X size={12} color="#94A9B8" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                      placeholder="새 음식 이름"
                      className="flex-1 min-w-0 text-[12px] rounded px-2 py-1.5"
                      style={{ border: "1px solid #BAE6FD" }}
                    />
                    <button onClick={submitAdd} aria-label="추가" className="shrink-0">
                      <Plus size={16} color={SKY} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
