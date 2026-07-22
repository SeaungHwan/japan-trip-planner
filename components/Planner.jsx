"use client";

import { useEffect, useState } from "react";
import { REGIONS, REGIONS_MORE } from "@/data/regions";
import { loadChecked, saveChecked } from "@/lib/storage";
import MapView from "@/components/MapView";
import RegionChips from "@/components/RegionChips";
import RegionHeader from "@/components/RegionHeader";
import FlightCard from "@/components/FlightCard";
import SpotsPanel from "@/components/SpotsPanel";
import ModeToggle from "@/components/ModeToggle";
import DayCards from "@/components/DayCards";

export default function Planner() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("transit");
  const [checked, setChecked] = useState({});
  const [showMore, setShowMore] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setChecked(loadChecked());
  }, []);

  const regions = showMore ? REGIONS.concat(REGIONS_MORE) : REGIONS;
  const region = regions[active];

  function selectRegion(i) {
    setActive(i);
    setShowSpots(false);
    setZoomed(true);
  }

  function toggleMore() {
    setShowMore((prev) => {
      const next = !prev;
      if (!next && active >= REGIONS.length) setActive(0);
      return next;
    });
  }

  function toggleDay(regionId, dayIdx) {
    setChecked((prev) => {
      const key = `${regionId}-${mode}-${dayIdx}`;
      const next = { ...prev, [key]: !prev[key] };
      saveChecked(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen w-full" style={{ background: "#FFFFFF" }}>
      <div className="max-w-md mx-auto px-4 pt-8 pb-16">
        <div className="mb-4 anim-fadeup">
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "#0EA5E9" }}>
            9.18 &mdash; 9.22
          </p>
          <h1 className="text-3xl mt-1 serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            일본 소도시 여행
          </h1>
          <p className="text-sm mt-1" style={{ color: "#5B7A90" }}>
            지도 위 핀을 탭하면 그 지역으로 확대돼요
          </p>
        </div>

        <MapView
          regions={regions}
          active={active}
          zoomed={zoomed}
          onSelect={selectRegion}
          onZoomOut={() => setZoomed(false)}
        />
        <p className="text-[10px] mb-5 mt-1" style={{ color: "#94A9B8" }}>
          지도: Wikimedia Commons (NordNordWest, CC BY-SA 3.0) · 명소 핀은 실제 위경도 기준 위치입니다
        </p>

        <RegionChips
          regions={regions}
          active={active}
          onSelect={selectRegion}
          showMore={showMore}
          onToggleMore={toggleMore}
          moreCount={REGIONS_MORE.length}
        />

        <RegionHeader region={region} />
        <FlightCard flight={region.flight} />
        <SpotsPanel spots={region.moreSpots} open={showSpots} onToggle={() => setShowSpots((v) => !v)} />
        <ModeToggle mode={mode} onChange={setMode} />
        <DayCards days={region.days} mode={mode} regionId={region.id} checked={checked} onToggleDay={toggleDay} />

        <p className="text-[11px] mt-6 text-center" style={{ color: "#94A9B8" }}>
          항공 노선·운항 스케줄은 예약 전 항공사 홈페이지에서 재확인해주세요
        </p>
      </div>
    </div>
  );
}
