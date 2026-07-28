"use client";

import { useState } from "react";
import { UtensilsCrossed, ChevronRight, X, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import IconButton from "@/components/IconButton";
import LazyImage from "@/components/LazyImage";
import { SKY } from "@/lib/theme";

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
        className="flex-1 min-w-0 rounded-lg flex items-center justify-between px-2.5 py-1.5 bg-sky-bg border border-sky-border"
        onClick={onToggle}
      >
        <span className="flex items-center gap-1 text-[12px] min-w-0 text-ink font-bold">
          <UtensilsCrossed size={12} color={SKY} className="shrink-0" /> <span className="truncate">지역 음식</span>
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          <span className="text-[11px] text-faint">
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
                <Plus size={23} color={adding ? SKY : "#5B7A90"} />
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
                className="w-full text-[13px] rounded-lg px-2.5 py-2 border border-sky-border"
              />
              <div className="flex justify-end">
                <button
                  onClick={saveNewFood}
                  className="text-[12px] rounded-lg px-3 py-1.5 bg-sky text-white font-bold"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* 예전 데이터는 이름 문자열만 있고, AI로 생성된 항목은 {name, imageUrl} 객체입니다. */}
              {(foods || []).map((food, i) => {
                const name = typeof food === "string" ? food : food.name;
                const imageUrl = typeof food === "object" ? food.imageUrl : null;
                return (
                  <span
                    key={i}
                    className="text-[12px] pl-2.5 pr-1.5 py-1.5 rounded-full flex items-center gap-1.5 bg-sky-bg border border-sky-border text-ink"
                  >
                    {imageUrl && (
                      <LazyImage key={imageUrl} src={imageUrl} className="w-5 h-5 rounded-full shrink-0" />
                    )}
                    <span>{name}</span>
                    {canEdit && (
                      <IconButton onClick={() => onDeleteFood?.(i)} ariaLabel="음식 삭제">
                        <X size={15} color="#94A9B8" />
                      </IconButton>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
