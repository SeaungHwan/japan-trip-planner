"use client";

import { useEffect, useState } from "react";
import { CloudSun, Umbrella } from "lucide-react";

const SKY = "#0EA5E9";

export default function WeatherBadge({ lat, lng, startDate, endDate }) {
  const [weather, setWeather] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    setWeather(null);
    if (typeof lat !== "number" || typeof lng !== "number" || !startDate || !endDate) return;
    let alive = true;
    fetch("/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, startDate, endDate }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (alive && !data.error) setWeather(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lat, lng, startDate, endDate]);

  if (!weather) return null;

  return (
    <div className="relative">
      <button onClick={() => setShowDetail((v) => !v)} className="flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }}>
        <CloudSun size={12} /> {weather.avgLow}°~{weather.avgHigh}°C
      </button>
      {showDetail && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetail(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-lg p-3 text-[12px]"
            style={{ background: "#FFFFFF", border: "1px solid #BAE6FD", minWidth: 190, color: "#0F2A3D" }}
          >
            <p className="mb-1" style={{ fontWeight: 700 }}>
              최근 {weather.years.length}년 평균 날씨
            </p>
            <p style={{ color: "#5B7A90" }}>
              최고 {weather.avgHigh}°C · 최저 {weather.avgLow}°C
            </p>
            <p className="flex items-center gap-1 mt-1" style={{ color: "#5B7A90" }}>
              <Umbrella size={11} /> 비 올 확률 약 {weather.rainyChance}%
            </p>
            <p className="mt-1.5 text-[11px]" style={{ color: "#94A9B8" }}>
              실제 예보가 아닌 과거 평균치예요. 여행 전 예보를 다시 확인하세요.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
