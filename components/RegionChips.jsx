"use client";

import { memo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getIcon } from "@/data/icons";

const SKY = "#0EA5E9";

// index/onSelect(안정된 참조)를 그대로 받아 클릭 핸들러를 내부에서 만듭니다.
// 그래야 부모가 렌더링될 때마다 새 함수를 넘겨서 memo가 무력화되는 걸 막을 수 있습니다.
const Chip = memo(function Chip({ r, isActive, index, onSelect }) {
  const Icon = getIcon(r.icon);
  return (
    <button
      className="chip-btn shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm"
      style={{
        background: isActive ? SKY : "#F0F9FF",
        color: isActive ? "#FFFFFF" : "#0F2A3D",
        border: `1px solid ${isActive ? SKY : "#BAE6FD"}`,
        fontWeight: isActive ? 700 : 500,
      }}
      onClick={() => onSelect(index)}
    >
      <Icon size={14} />
      {r.kr}
    </button>
  );
});

export default function RegionChips({ regions, active, onSelect, showMore, onToggleMore, moreCount, baseCount }) {
  const base = regions.slice(0, baseCount);
  const extra = regions.slice(baseCount);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 mt-4 -mx-4 px-4 chip-row">
        {base.map((r, i) => (
          <Chip key={r.id} r={r} isActive={i === active} index={i} onSelect={onSelect} />
        ))}
      </div>
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
    </>
  );
}
