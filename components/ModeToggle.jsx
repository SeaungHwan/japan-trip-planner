"use client";

import { TrainFront, Car } from "lucide-react";

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="relative flex rounded-full p-1 mb-3" style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
      <div
        className="toggle-indicator absolute top-1 bottom-1 rounded-full"
        style={{
          width: "calc(50% - 4px)",
          background: "#0EA5E9",
          left: 4,
          transform: mode === "transit" ? "translateX(0)" : "translateX(100%)",
        }}
      />
      <button
        className="relative flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm z-10"
        style={{ color: mode === "transit" ? "#FFFFFF" : "#5B7A90", fontWeight: 700 }}
        onClick={() => onChange("transit")}
      >
        <TrainFront size={15} /> 대중교통 코스
      </button>
      <button
        className="relative flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm z-10"
        style={{ color: mode === "car" ? "#FFFFFF" : "#5B7A90", fontWeight: 700 }}
        onClick={() => onChange("car")}
      >
        <Car size={15} /> 렌트카 코스
      </button>
    </div>
  );
}
