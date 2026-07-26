"use client";

import { memo } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { getIcon } from "@/data/icons";

const SKY = "#0EA5E9";

// index/onSelect(안정된 참조)를 그대로 받아 클릭 핸들러를 내부에서 만듭니다.
// 그래야 부모가 렌더링될 때마다 새 함수를 넘겨서 memo가 무력화되는 걸 막을 수 있습니다.
// 폭을 이름 길이에 맡기지 않고 고정해서, 화면에 한 번에 3~4개만 보이고 나머지는
// 옆으로 스크롤해야 보이게 합니다.
const Chip = memo(function Chip({ r, isActive, index, onSelect }) {
  const Icon = getIcon(r.icon);
  return (
    <button
      className="chip-btn shrink-0 flex items-center justify-center gap-1.5 rounded-full px-2 text-sm"
      style={{
        width: 96,
        height: 40,
        background: isActive ? SKY : "#F0F9FF",
        color: isActive ? "#FFFFFF" : "#0F2A3D",
        border: `1px solid ${isActive ? SKY : "#BAE6FD"}`,
        fontWeight: isActive ? 700 : 500,
      }}
      onClick={() => onSelect(index)}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{r.kr}</span>
    </button>
  );
});

export default function RegionChips({ regions, active, onSelect, showMore, onToggleMore, moreCount, baseCount, canAddRegion, onAddRegion }) {
  const base = regions.slice(0, baseCount);
  const extra = regions.slice(baseCount);

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 mt-4 -mx-4 px-4 chip-row">
        {base.map((r, i) => (
          <Chip key={r.id} r={r} isActive={i === active} index={i} onSelect={onSelect} />
        ))}
        {canAddRegion && (
          <button
            className="shrink-0 flex items-center justify-center rounded-full sticky right-0 ml-auto"
            style={{ width: 30, height: 30, background: "#FFFFFF", color: SKY, border: "1px dashed #BAE6FD" }}
            onClick={onAddRegion}
            aria-label="새 지역 추가"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {(moreCount > 0 || extra.length > 0) && (
        <div className="mb-5">
          {moreCount > 0 && (
            <button
              className="text-xs mb-2 flex items-center gap-1"
              style={{ color: SKY, fontWeight: 700 }}
              onClick={onToggleMore}
            >
              {showMore ? (
                <>
                  <ChevronUp size={14} /> 접기
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> 여행지 더보기 (+{moreCount})
                </>
              )}
            </button>
          )}
          {extra.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extra.map((r, j) => (
                <Chip key={r.id} r={r} isActive={baseCount + j === active} index={baseCount + j} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
