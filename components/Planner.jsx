"use client";

import { useEffect, useRef, useState } from "react";
import { REGIONS, REGIONS_MORE } from "@/data/regions";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";
import UserBadge from "@/components/UserBadge";
import MapView from "@/components/MapView";
import RegionChips from "@/components/RegionChips";
import RegionHeader from "@/components/RegionHeader";
import FlightCard from "@/components/FlightCard";
import SpotsPanel from "@/components/SpotsPanel";
import ModeToggle from "@/components/ModeToggle";
import DayCards from "@/components/DayCards";
import AddRegionForm from "@/components/AddRegionForm";
import TripSwitcher from "@/components/TripSwitcher";

const DEFAULT_TRIP = { id: "japan-trip", title: "일본 여행", subtitle: "9.18 — 9.22" };

function toRegion(row) {
  return {
    id: `custom-${row.id}`,
    tripId: row.trip_id || DEFAULT_TRIP.id,
    kr: row.kr,
    jp: row.jp || "",
    icon: "landmark",
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    moreSpots: (row.spots || []).map((name) => ({ name })),
    days: row.days || [],
    isCustom: true,
  };
}

export default function Planner() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("transit");
  const [showMore, setShowMore] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [focus, setFocus] = useState(null);
  const [userRegions, setUserRegions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState(DEFAULT_TRIP.id);
  const mapSectionRef = useRef(null);

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

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: true });
      if (active) setTrips(data || []);
    }
    load();

    const channel = supabase
      .channel("trips_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trips" }, (payload) => {
        setTrips((prev) => (prev.some((t) => t.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const allTrips = [DEFAULT_TRIP, ...trips];
  const activeTrip = allTrips.find((t) => t.id === activeTripId) || DEFAULT_TRIP;
  const isDefaultTrip = activeTripId === DEFAULT_TRIP.id;
  const tripUserRegions = userRegions.filter((r) => r.tripId === activeTripId);

  const regions = isDefaultTrip
    ? showMore
      ? REGIONS.concat(REGIONS_MORE).concat(tripUserRegions)
      : REGIONS
    : tripUserRegions;
  const region = regions[active];

  function selectRegion(i) {
    setActive(i);
    setShowSpots(false);
    setZoomed(true);
    setFocus(null);
  }

  function selectTrip(id) {
    setActiveTripId(id);
    setActive(0);
    setShowMore(false);
    setShowSpots(false);
    setZoomed(false);
    setFocus(null);
  }

  async function saveTrip(id, title, subtitle) {
    const identity = await getIdentity();
    if (!identity) return;
    const tripId = id || crypto.randomUUID();
    const { data } = await supabase
      .from("trips")
      .upsert({ id: tripId, title, subtitle: subtitle || null, created_by: identity.nickname }, { onConflict: "id" })
      .select()
      .single();
    if (data) {
      setTrips((prev) => (prev.some((t) => t.id === data.id) ? prev.map((t) => (t.id === data.id ? data : t)) : [...prev, data]));
      selectTrip(data.id);
    }
  }

  function locateItem(point) {
    setFocus(point);
    setZoomed(true);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleMore() {
    setShowMore((prev) => {
      const next = !prev;
      if (!next && active >= REGIONS.length) setActive(0);
      return next;
    });
  }

  return (
    <div className="min-h-screen w-full" style={{ background: "#FFFFFF" }}>
      <div className="max-w-md mx-auto px-4 pt-8 pb-16">
        <UserBadge />
        <div className="mb-4 anim-fadeup">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "#0EA5E9" }}>
              {activeTrip.subtitle || "TRIP"}
            </p>
            <TripSwitcher trips={allTrips} activeTripId={activeTripId} onSelect={selectTrip} onSave={saveTrip} />
          </div>
          <h1 className="text-3xl mt-1 serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            {activeTrip.title}
          </h1>
        </div>

        <div ref={mapSectionRef}>
          <MapView
            regions={regions}
            active={active}
            zoomed={zoomed}
            onSelect={selectRegion}
            onZoomOut={() => {
              setZoomed(false);
              setFocus(null);
            }}
            focus={focus}
          />
        </div>

        <RegionChips
          regions={regions}
          active={active}
          onSelect={selectRegion}
          showMore={showMore}
          onToggleMore={toggleMore}
          moreCount={isDefaultTrip ? REGIONS_MORE.length + tripUserRegions.length : 0}
          baseCount={isDefaultTrip ? REGIONS.length : tripUserRegions.length}
        />

        <button
          className="text-xs mb-4 -mt-3 flex items-center gap-1"
          style={{ color: "#5B7A90", fontWeight: 700 }}
          onClick={() => setShowAddForm(true)}
        >
          + 새 지역 추가
        </button>

        {regions.length === 0 ? (
          <p className="text-[13px] text-center mt-8" style={{ color: "#94A9B8" }}>
            이 여행에는 아직 지역이 없어요. 위의 &quot;+ 새 지역 추가&quot;로 시작해보세요.
          </p>
        ) : (
          <>
            <RegionHeader region={region} />
            {!region.isCustom && <FlightCard flight={region.flight} />}
            <SpotsPanel spots={region.moreSpots} open={showSpots} onToggle={() => setShowSpots((v) => !v)} />
            {region.days?.length > 0 && (
              <>
                <ModeToggle mode={mode} onChange={setMode} />
                <DayCards days={region.days} mode={mode} regionId={region.id} onLocateItem={locateItem} />
              </>
            )}
          </>
        )}

        {showAddForm && (
          <AddRegionForm
            tripId={activeTripId}
            onClose={() => setShowAddForm(false)}
            onAdded={(row) => {
              setUserRegions((prev) => (prev.some((r) => r.id === `custom-${row.id}`) ? prev : [...prev, toRegion(row)]));
              if (isDefaultTrip) setShowMore(true);
            }}
          />
        )}

        {isDefaultTrip && (
          <p className="text-[11px] mt-6 text-center" style={{ color: "#94A9B8" }}>
            항공 노선·운항 스케줄은 예약 전 항공사 홈페이지에서 재확인해주세요
          </p>
        )}
      </div>
    </div>
  );
}
