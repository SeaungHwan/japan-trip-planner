"use client";

import { Check } from "lucide-react";
import Feedback from "@/components/Feedback";

const SKY = "#0EA5E9";

export default function DayCards({ days, mode, regionId, checked, onToggleDay }) {
  return (
    <div className="flex flex-col gap-3">
      {days.map((day, di) => {
        const plan = day[mode];
        const key = `${regionId}-${mode}-${di}`;
        const done = !!checked[key];
        return (
          <div
            key={di}
            className="day-card rounded-xl p-4"
            style={{
              animationDelay: `${di * 0.05}s`,
              background: done ? "#F0F9FF" : "#FFFFFF",
              border: `1px solid ${done ? SKY : "#BAE6FD"}`,
              opacity: done ? 0.7 : 1,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className="text-xs shrink-0 mt-0.5 rounded-full w-6 h-6 flex items-center justify-center"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  {di + 1}
                </span>
                <div>
                  <div
                    className="text-[15px]"
                    style={{ color: "#0F2A3D", fontWeight: 700, textDecoration: done ? "line-through" : "none" }}
                  >
                    {plan.title}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {plan.items.map((it, ii) => (
                      <li key={ii} className="text-[13px]" style={{ color: "#5B7A90" }}>
                        &middot; {it}
                      </li>
                    ))}
                  </ul>
                  <Feedback targetKey={`day:${regionId}:${di}`} />
                </div>
              </div>
              <button
                className={done ? "check-btn done shrink-0 w-6 h-6 rounded-md flex items-center justify-center" : "check-btn shrink-0 w-6 h-6 rounded-md flex items-center justify-center"}
                style={{ background: done ? SKY : "transparent", border: `1px solid ${done ? SKY : "#94A9B8"}` }}
                onClick={() => onToggleDay(regionId, di)}
                aria-label="완료 체크"
              >
                {done && <Check size={14} color="#FFFFFF" />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
