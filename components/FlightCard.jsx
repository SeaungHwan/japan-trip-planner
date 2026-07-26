"use client";

import { PlaneTakeoff } from "lucide-react";

const SKY = "#0EA5E9";

export default function FlightCard({ flight }) {
  return (
    <div className="rounded-xl p-3 mb-3 anim-fadeup" style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <PlaneTakeoff size={14} color={SKY} />
        <span className="text-[13px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          항공편 정보
        </span>
      </div>
      <div className="text-[12px] space-y-1.5" style={{ color: "#3B586B" }}>
        <div>
          <span style={{ color: SKY, fontWeight: 700 }}>인천 → </span>
          {flight.incheon}
        </div>
        <div>
          <span style={{ color: SKY, fontWeight: 700 }}>청주 → </span>
          {flight.cheongju}
        </div>
        {flight.note && (
          <div className="text-[11px] pt-1" style={{ color: "#5B7A90" }}>
            ※ {flight.note}
          </div>
        )}
      </div>
    </div>
  );
}
