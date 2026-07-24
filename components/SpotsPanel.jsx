"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Star, ChevronDown, ChevronUp, MapPin, X, Plus } from "lucide-react";

const SKY = "#0EA5E9";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 180, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

export default function SpotsPanel({ spots, open, onToggle, onLocateSpot, canEdit, onAddSpot, onDeleteSpot, onSetLocation }) {
  const [newName, setNewName] = useState("");
  const [locatingIndex, setLocatingIndex] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);

  function submitAdd() {
    if (!newName.trim()) return;
    onAddSpot?.(newName);
    setNewName("");
  }

  function openLocationPicker(i) {
    setLocatingIndex((cur) => (cur === i ? null : i));
    const s = spots[i];
    setPendingPoint(s && typeof s.lat === "number" ? { lat: s.lat, lng: s.lng } : null);
  }

  function closeLocationPicker() {
    setLocatingIndex(null);
    setPendingPoint(null);
  }

  function confirmLocation() {
    if (locatingIndex == null || !pendingPoint) return;
    onSetLocation?.(locatingIndex, pendingPoint);
    closeLocationPicker();
  }

  function clearLocation() {
    if (locatingIndex == null) return;
    onSetLocation?.(locatingIndex, null);
    closeLocationPicker();
  }

  const locatingSpot = locatingIndex != null ? spots[locatingIndex] : null;

  return (
    <div className="rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid #BAE6FD" }}>
      <button className="w-full flex items-center justify-between p-3" style={{ background: "#F0F9FF" }} onClick={onToggle}>
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          <Star size={14} color="#0EA5E9" /> 주변 명소
        </span>
        {open ? <ChevronUp size={16} color="#5B7A90" /> : <ChevronDown size={16} color="#5B7A90" />}
      </button>
      <div className={open ? "spots-panel open" : "spots-panel"}>
        <div className="flex flex-wrap gap-2 p-3 pt-2">
          {(spots || []).map((s, i) => {
            const hasLocation = typeof s.lat === "number" && typeof s.lng === "number";
            const pinColor = hasLocation ? "#F59E0B" : "#94A9B8";
            return (
              <span
                key={i}
                className="text-[12px] pl-2.5 pr-1.5 py-1.5 rounded-full flex items-center gap-1"
                style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
              >
                {canEdit && (
                  <button onClick={() => openLocationPicker(i)} aria-label="위치 설정" className="shrink-0">
                    <MapPin size={11} color={pinColor} />
                  </button>
                )}
                {!canEdit && <MapPin size={11} color={pinColor} className="shrink-0" />}
                {hasLocation ? (
                  <button onClick={() => onLocateSpot?.({ lat: s.lat, lng: s.lng, name: s.name })}>{s.name}</button>
                ) : canEdit ? (
                  <button onClick={() => openLocationPicker(i)}>{s.name}</button>
                ) : (
                  <span>{s.name}</span>
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

        {canEdit && locatingSpot && (
          <div className="rounded-lg p-2 mx-3 mb-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px]" style={{ color: "#5B7A90" }}>
                &quot;{locatingSpot.name}&quot; 위치 지정
              </span>
              <button onClick={closeLocationPicker} aria-label="닫기">
                <X size={14} color="#94A9B8" />
              </button>
            </div>
            <LocationPicker point={pendingPoint} onPick={setPendingPoint} />
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={confirmLocation}
                disabled={!pendingPoint}
                className="text-[12px]"
                style={{ color: SKY, fontWeight: 700, opacity: pendingPoint ? 1 : 0.5 }}
              >
                위치 저장
              </button>
              {typeof locatingSpot.lat === "number" && (
                <button onClick={clearLocation} className="text-[12px]" style={{ color: "#EF4444", fontWeight: 700 }}>
                  위치 삭제
                </button>
              )}
            </div>
          </div>
        )}

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
