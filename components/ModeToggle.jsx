"use client";

import { TrainFront, Car } from "lucide-react";
import { MUTED } from "@/lib/theme";

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="relative flex rounded-full p-1 mb-3 bg-sky-bg border border-sky-border">
      <div
        className="toggle-indicator absolute top-1 bottom-1 rounded-full w-[calc(50%_-_4px)] bg-sky left-[4px]"
        style={{
          transform: mode === "transit" ? "translateX(0)" : "translateX(100%)",
        }}
      />
      <button
        className="relative flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm z-10 font-bold"
        style={{ color: mode === "transit" ? "#FFFFFF" : MUTED }}
        onClick={() => onChange("transit")}
      >
        <TrainFront size={15} /> 대중교통 코스
      </button>
      <button
        className="relative flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm z-10 font-bold"
        style={{ color: mode === "car" ? "#FFFFFF" : MUTED }}
        onClick={() => onChange("car")}
      >
        <Car size={15} /> 렌트카 코스
      </button>
    </div>
  );
}
