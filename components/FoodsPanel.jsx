"use client";

import { useState } from "react";
import { UtensilsCrossed, ChevronRight, X, Plus } from "lucide-react";
import Modal from "@/components/Modal";

const SKY = "#0EA5E9";

// 명소(SpotsPanel)와 같은 모양이지만 위치 데이터가 필요 없어서 이름만 다루는
// 훨씬 단순한 버전입니다(지도 연동 없음).
export default function FoodsPanel({ foods, open, onToggle, canEdit, onAddFood, onDeleteFood }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  function saveNewFood() {
    if (!newName.trim()) return;
    onAddFood?.(newName);
    setNewName("");
    setAdding(false);
  }

  function handleClose() {
    setNewName("");
    setAdding(false);
    onToggle();
  }

  return (
    <>
      <button
        className="flex-1 min-w-0 rounded-lg flex items-center justify-between px-2.5 py-1.5"
        style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
        onClick={onToggle}
      >
        <span className="flex items-center gap-1 text-[12px] min-w-0" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          <UtensilsCrossed size={12} color={SKY} className="shrink-0" /> <span className="truncate">지역 음식</span>
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          <span className="text-[11px]" style={{ color: "#94A9B8" }}>
            {(foods || []).length}
          </span>
          <ChevronRight size={13} color="#5B7A90" />
        </span>
      </button>

      {open && (
        <Modal
          icon={UtensilsCrossed}
          title="지역 음식"
          onClose={handleClose}
          headerExtra={
            canEdit && (
              <button onClick={() => setAdding((v) => !v)} aria-label="음식 추가" className="shrink-0">
                <Plus size={18} color={adding ? SKY : "#5B7A90"} />
              </button>
            )
          }
        >
          {adding ? (
            <div className="flex flex-col gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNewFood()}
                placeholder="새 음식 이름"
                autoFocus
                className="w-full text-[13px] rounded-lg px-2.5 py-2"
                style={{ border: "1px solid #BAE6FD" }}
              />
              <div className="flex justify-end">
                <button
                  onClick={saveNewFood}
                  className="text-[12px] rounded-lg px-3 py-1.5"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
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
          )}
        </Modal>
      )}
    </>
  );
}
