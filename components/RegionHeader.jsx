"use client";

import { getIcon } from "@/data/icons";

const SKY = "#0EA5E9";

export default function RegionHeader({ region }) {
  const Icon = getIcon(region.icon);
  return (
    <div className="flex items-center gap-2 mb-3 anim-fadeup" key={region.id}>
      <Icon size={18} color={SKY} />
      <span className="text-lg serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
        {region.kr}
      </span>
      <span className="text-xs" style={{ color: "#94A9B8" }}>
        {region.jp}
      </span>
    </div>
  );
}
