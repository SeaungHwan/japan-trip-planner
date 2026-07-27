"use client";

import { PlaneTakeoff } from "lucide-react";
import { SKY } from "@/lib/theme";

export default function FlightCard({ flight }) {
  return (
    <div className="rounded-xl p-3 mb-3 anim-fadeup bg-sky-bg border border-sky-border">
      <div className="flex items-center gap-1.5 mb-2">
        <PlaneTakeoff size={14} color={SKY} />
        <span className="text-[13px] text-ink font-bold">
          항공편 정보
        </span>
      </div>
      <div className="text-[12px] space-y-1.5" style={{ color: "#3B586B" }}>
        <div className="flex gap-1.5">
          <span className="shrink-0 text-sky font-bold">
            인천 →
          </span>
          <span className="flex-1 min-w-0">{flight.incheon}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="shrink-0 text-sky font-bold">
            청주 →
          </span>
          <span className="flex-1 min-w-0">{flight.cheongju}</span>
        </div>
        {flight.note && (
          <div className="text-[11px] pt-1 text-muted">
            ※ {flight.note}
          </div>
        )}
      </div>
    </div>
  );
}
