"use client";

import { Star, ChevronDown, ChevronUp, MapPin } from "lucide-react";

export default function SpotsPanel({ spots, open, onToggle }) {
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
          {(spots || []).map((s, i) => (
            <span
              key={i}
              className="text-[12px] px-2.5 py-1.5 rounded-full flex items-center gap-1"
              style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
            >
              <MapPin size={11} color="#F59E0B" />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
