"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Star, ChevronRight, MapPin, X, Plus } from "lucide-react";
import Modal from "@/components/Modal";

const SKY = "#0EA5E9";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 180, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

// 일정 자세히보기 팝업과 같은 독립된 미니맵입니다. 예전에는 명소 이름을 누르면 메인
// 지도가 그 지점으로 확대/이동했는데, 패널을 닫아야 지도가 보이는 데다 메인 지도
// 상태(줌/포커스)를 명소 하나 보자고 계속 건드리게 되어서, 이 팝업 안에서만 움직이는
// 자체 지도로 바꿨습니다.
const DayDetailMap = dynamic(() => import("@/components/DayDetailMap"), {
  ssr: false,
  loading: () => <div className="rounded-lg mb-3" style={{ height: 160, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

export default function SpotsPanel({ spots, open, onToggle, canEdit, onAddSpot, onDeleteSpot, onSetLocation }) {
  const [newName, setNewName] = useState("");
  const [locatingIndex, setLocatingIndex] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [focusPoint, setFocusPoint] = useState(null);
  const [adding, setAdding] = useState(false);

  const mapPoints = (spots || [])
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s, i) => ({ lat: s.lat, lng: s.lng, name: s.name, num: i + 1 }));

  function saveNewSpot() {
    if (!newName.trim()) return;
    onAddSpot?.(newName);
    setNewName("");
    setAdding(false);
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

  function handleClose() {
    closeLocationPicker();
    setNewName("");
    setFocusPoint(null);
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
          <Star size={12} color="#0EA5E9" className="shrink-0" /> <span className="truncate">주변 명소</span>
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          <span className="text-[11px]" style={{ color: "#94A9B8" }}>
            {(spots || []).length}
          </span>
          <ChevronRight size={13} color="#5B7A90" />
        </span>
      </button>

      {open && (
        <Modal
          icon={Star}
          title="주변 명소"
          onClose={handleClose}
          headerExtra={
            canEdit && (
              <button onClick={() => setAdding((v) => !v)} aria-label="명소 추가" className="shrink-0">
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
                onKeyDown={(e) => e.key === "Enter" && saveNewSpot()}
                placeholder="새 명소 이름"
                autoFocus
                className="w-full text-[13px] rounded-lg px-2.5 py-2"
                style={{ border: "1px solid #BAE6FD" }}
              />
              <div className="flex justify-end">
                <button
                  onClick={saveNewSpot}
                  className="text-[12px] rounded-lg px-3 py-1.5"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              {mapPoints.length > 0 && <DayDetailMap points={mapPoints} focus={focusPoint} />}
              <div className="flex flex-wrap gap-2">
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
                        <button onClick={() => setFocusPoint({ lat: s.lat, lng: s.lng })}>{s.name}</button>
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
                <div className="rounded-lg p-2 mt-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
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
            </>
          )}
        </Modal>
      )}
    </>
  );
}
