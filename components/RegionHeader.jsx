"use client";

import { Trash2 } from "lucide-react";
import { getIcon } from "@/data/icons";
import Feedback from "@/components/Feedback";

const SKY = "#0EA5E9";

export default function RegionHeader({ region, onDelete }) {
  const Icon = getIcon(region.icon);
  return (
    <div className="mb-3 anim-fadeup" key={region.id}>
      <div className="flex items-center gap-2">
        <Icon size={18} color={SKY} />
        <span className="text-lg serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          {region.kr}
        </span>
        <span className="text-xs" style={{ color: "#94A9B8" }}>
          {region.jp}
        </span>
        {region.isCustom && onDelete && (
          <button onClick={onDelete} aria-label="지역 삭제" className="ml-auto shrink-0">
            <Trash2 size={15} color="#94A9B8" />
          </button>
        )}
      </div>
      {region.note && (
        <p className="text-[13px] mt-1" style={{ color: "#5B7A90" }}>
          {region.note}
        </p>
      )}
      <Feedback targetKey={`region:${region.id}`} />
    </div>
  );
}
