"use client";

import { useEffect, useState } from "react";
import { REGIONS, REGIONS_MORE } from "@/data/regions";
import { loadChecked, saveChecked } from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";
import MapView from "@/components/MapView";
import RegionChips from "@/components/RegionChips";
import RegionHeader from "@/components/RegionHeader";
import FlightCard from "@/components/FlightCard";
import SpotsPanel from "@/components/SpotsPanel";
import ModeToggle from "@/components/ModeToggle";
import DayCards from "@/components/DayCards";
import AddRegionForm from "@/components/AddRegionForm";

function toRegion(row) {
  return {
    id: `custom-${row.id}`,
    kr: row.kr,
    jp: row.jp || "",
    icon: "landmark",
    x: row.x,
    y: row.y,
    note: row.note,
    moreSpots: (row.spots || []).map((name) => ({ name })),
    isCustom: true,
  };
}

export default function Planner() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("transit");
  const [checked, setChecked] = useState({});
  const [showMore, setShowMore] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [userRegions, setUserRegions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setChecked(loadChecked());
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from("user_regions").select("*").order("created_at", { ascending: true });
      if (active) setUserRegions((data || []).map(toRegion));
    }
    load();

    const channel = supabase
      .channel("user_regions_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_regions" }, (payload) => {
        setUserRegions((prev) => (prev.some((r) => r.id === `custom-${payload.new.id}`) ? prev : [...prev, toRegion(payload.new)]));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const regions = (showMore ? REGIONS.concat(REGIONS_MORE) : REGIONS).concat(userRegions);
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

        <button
          className="text-xs mb-4 -mt-3 flex items-center gap-1"
          style={{ color: "#5B7A90", fontWeight: 700 }}
          onClick={() => setShowAddForm(true)}
        >
          + 새 지역 추가
        </button>

        <RegionHeader region={region} />
        {!region.isCustom && <FlightCard flight={region.flight} />}
        <SpotsPanel spots={region.moreSpots} open={showSpots} onToggle={() => setShowSpots((v) => !v)} regionId={region.id} />
        {!region.isCustom && (
          <>
            <ModeToggle mode={mode} onChange={setMode} />
            <DayCards days={region.days} mode={mode} regionId={region.id} checked={checked} onToggleDay={toggleDay} />
          </>
        )}

        {showAddForm && (
          <AddRegionForm
            onClose={() => setShowAddForm(false)}
            onAdded={(row) => setUserRegions((prev) => (prev.some((r) => r.id === `custom-${row.id}`) ? prev : [...prev, toRegion(row)]))}
          />
        )}

        <p className="text-[11px] mt-6 text-center" style={{ color: "#94A9B8" }}>
          항공 노선·운항 스케줄은 예약 전 항공사 홈페이지에서 재확인해주세요
        </p>
      </div>
    </div>
  );
}
