"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { getIcon } from "@/data/icons";

const SKY = "#0EA5E9";

export default function RegionChips({ regions, active, onSelect, showMore, onToggleMore, moreCount }) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 mt-4 -mx-4 px-4 chip-row">
        {regions.map((r, i) => {
          const isActive = i === active;
          const Icon = getIcon(r.icon);
          return (
            <button
              key={r.id}
              className="chip-btn shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm"
              style={{
                background: isActive ? SKY : "#F0F9FF",
                color: isActive ? "#FFFFFF" : "#0F2A3D",
                border: `1px solid ${isActive ? SKY : "#BAE6FD"}`,
                fontWeight: isActive ? 700 : 500,
              }}
              onClick={() => onSelect(i)}
            >
              <Icon size={14} />
              {r.kr}
            </button>
          );
        })}
      </div>
      <button
        className="text-xs mb-5 flex items-center gap-1"
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
    </>
  );
}
