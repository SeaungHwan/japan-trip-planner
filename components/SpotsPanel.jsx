"use client";

import { useState } from "react";
import { Star, ChevronDown, ChevronUp, MapPin, X, Plus } from "lucide-react";

const SKY = "#0EA5E9";

export default function SpotsPanel({ spots, open, onToggle, onLocateSpot, canEdit, onAddSpot, onDeleteSpot }) {
  const [newName, setNewName] = useState("");

  function submitAdd() {
    if (!newName.trim()) return;
    onAddSpot?.(newName);
    setNewName("");
  }

  return (
    <div className="rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid #BAE6FD" }}>
      <button className="w-full flex items-center justify-between p-3" style={{ background: "#F0F9FF" }} onClick={onToggle}>
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          <Star size={14} color="#0EA5E9" /> 이 지역 더 가볼만한 곳
        </span>
        {open ? <ChevronUp size={16} color="#5B7A90" /> : <ChevronDown size={16} color="#5B7A90" />}
      </button>
      <div className={open ? "spots-panel open" : "spots-panel"}>
        <div className="flex flex-wrap gap-2 p-3 pt-2">
          {(spots || []).map((s, i) => {
            const hasLocation = typeof s.lat === "number" && typeof s.lng === "number";
            return (
              <span
                key={i}
                className="text-[12px] pl-2.5 pr-1.5 py-1.5 rounded-full flex items-center gap-1"
                style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
              >
                {hasLocation ? (
                  <button onClick={() => onLocateSpot?.({ lat: s.lat, lng: s.lng, name: s.name })} className="flex items-center gap-1">
                    <MapPin size={11} color="#F59E0B" />
                    {s.name}
                  </button>
                ) : (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} color="#F59E0B" />
                    {s.name}
                  </span>
                )}
                {canEdit && (
                  <button onClick={() => onDeleteSpot?.(i)} aria-label="명소 삭제" className="shrink-0">
                    <X size={12} color="#94A9B8" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1.5 px-3 pb-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              placeholder="새 명소 이름"
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
  );
}
