"use client";

import { useEffect, useState } from "react";
import { CloudSun, Umbrella } from "lucide-react";

// 과거 평균치라 같은 좌표·기간이면 응답이 절대 바뀌지 않는데도, 지역을 오갈 때마다
// 매번 Open-Meteo를 3년치씩 다시 불러오고 있었습니다(요청당 1~3초). 세션 동안은
// 같은 조회를 반복하지 않도록 모듈 스코프에 캐싱합니다(탭을 새로고침하면 비워짐).
const weatherCache = new Map();

function cacheKey(lat, lng, startDate, endDate) {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${startDate},${endDate}`;
}

export default function WeatherBadge({ lat, lng, startDate, endDate }) {
  const [weather, setWeather] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    setWeather(null);
    if (typeof lat !== "number" || typeof lng !== "number" || !startDate || !endDate) return;
    let alive = true;

    const key = cacheKey(lat, lng, startDate, endDate);
    const cached = weatherCache.get(key);
    if (cached) {
      cached.then((data) => alive && data && setWeather(data));
      return () => {
        alive = false;
      };
    }

    const request = fetch("/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, startDate, endDate }),
    })
      .then((res) => res.json())
      .then((data) => (data.error ? null : data))
      .catch(() => null);
    weatherCache.set(key, request);
    request.then((data) => alive && data && setWeather(data));

    return () => {
      alive = false;
    };
  }, [lat, lng, startDate, endDate]);

  if (!weather) return null;

  return (
    <div className="relative">
      <button onClick={() => setShowDetail((v) => !v)} className="flex items-center gap-1 text-sky font-bold">
        <CloudSun size={12} /> {weather.avgLow}°~{weather.avgHigh}°C
      </button>
      {showDetail && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetail(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-lg p-3 text-[12px] bg-white border border-sky-border min-w-[190px] text-ink"
          >
            <p className="mb-1 font-bold">
              최근 {weather.years.length}년 평균 날씨
            </p>
            <p className="text-muted">
              최고 {weather.avgHigh}°C · 최저 {weather.avgLow}°C
            </p>
            <p className="flex items-center gap-1 mt-1 text-muted">
              <Umbrella size={11} /> 비 올 확률 약 {weather.rainyChance}%
            </p>
            <p className="mt-1.5 text-[11px] text-faint">
              실제 예보가 아닌 과거 평균치예요. 여행 전 예보를 다시 확인하세요.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
