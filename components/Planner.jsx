"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity, checkIsMaster } from "@/lib/auth";
import UserBadge from "@/components/UserBadge";
import Spinner from "@/components/Spinner";
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
const MAX_BASE_REGIONS = 6;

function toRegion(row) {
  return {
    id: row.id,
    tripId: row.trip_id || DEFAULT_TRIP.id,
    kr: row.kr,
    jp: row.jp || "",
    icon: row.icon || "landmark",
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    flight: row.flight || null,
    moreSpots: (row.spots || []).map((s) => (typeof s === "string" ? { name: s } : s)),
    days: row.days || [],
    userId: row.user_id || null,
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
  const [identity, setIdentity] = useState(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const mapSectionRef = useRef(null);

  useEffect(() => {
    getIdentity().then(setIdentity);
    checkIsMaster().then(setIsMaster);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from("user_regions").select("*").order("created_at", { ascending: true });
      if (active) {
        setUserRegions((data || []).map(toRegion));
        setLoadingRegions(false);
      }
    }
    load();

    const channel = supabase
      .channel("user_regions_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_regions" }, load)
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

  const defaultTripOverride = trips.find((t) => t.id === DEFAULT_TRIP.id);
  const allTrips = [defaultTripOverride || DEFAULT_TRIP, ...trips.filter((t) => t.id !== DEFAULT_TRIP.id)];
  const activeTrip = allTrips.find((t) => t.id === activeTripId) || DEFAULT_TRIP;
  const isDefaultTrip = activeTripId === DEFAULT_TRIP.id;

  // 처음 만들어진 순서(created_at 오름차순)로 앞의 MAX_BASE_REGIONS개만 메인 스크롤에 두고
  // 나머지는 전부 "더보기"로 넘깁니다. 그래서 새로 추가한 지역은 항상 더보기 쪽에 들어가고,
  // 지역별로 is_extra를 일일이 설정/관리할 필요가 없습니다.
  const { baseRegions, extraRegions } = useMemo(() => {
    const tripRegions = userRegions.filter((r) => r.tripId === activeTripId);
    return {
      baseRegions: tripRegions.slice(0, MAX_BASE_REGIONS),
      extraRegions: tripRegions.slice(MAX_BASE_REGIONS),
    };
  }, [userRegions, activeTripId]);
  const regions = showMore ? baseRegions.concat(extraRegions) : baseRegions;
  const region = regions[active];

  const selectRegion = useCallback((i) => {
    setActive(i);
    setShowSpots(false);
    setZoomed(true);
    setFocus(null);
  }, []);

  function selectTrip(id) {
    setActiveTripId(id);
    setActive(0);
    setShowMore(false);
    setShowSpots(false);
    setZoomed(false);
    setFocus(null);
  }

  async function saveTrip(id, title, subtitle) {
    const tripIdentity = await getIdentity();
    if (!tripIdentity) return;
    const tripId = id || crypto.randomUUID();
    const { data } = await supabase
      .from("trips")
      .upsert({ id: tripId, title, subtitle: subtitle || null, created_by: tripIdentity.nickname, user_id: tripIdentity.id }, { onConflict: "id" })
      .select()
      .single();
    if (data) {
      setTrips((prev) => (prev.some((t) => t.id === data.id) ? prev.map((t) => (t.id === data.id ? data : t)) : [...prev, data]));
      selectTrip(data.id);
    }
  }

  function canDeleteTrip(trip) {
    if (trip.id === DEFAULT_TRIP.id) return false;
    return isMaster || (identity && trip.user_id === identity.id);
  }

  // 여행 공유 여부는 만든 사람만 바꿀 수 있습니다 — 마스터도 예외 없습니다.
  // 기본 여행(일본 여행)은 이미 항상 전원에게 공개된 상태라 공유 버튼 자체가 필요 없습니다.
  const canShareActiveTrip = activeTrip.id !== DEFAULT_TRIP.id && !!identity && activeTrip.user_id === identity.id;

  async function toggleShareTrip() {
    const { data, error } = await supabase
      .from("trips")
      .update({ is_shared: !activeTrip.is_shared })
      .eq("id", activeTrip.id)
      .select()
      .single();
    if (error) {
      alert("공유 설정을 바꾸지 못했어요: " + error.message);
      return;
    }
    setTrips((prev) => prev.map((t) => (t.id === data.id ? data : t)));
  }

  async function deleteTrip(trip) {
    if (!window.confirm(`"${trip.title}" 여행을 삭제할까요? 이 여행에 속한 지역도 함께 삭제됩니다.`)) return;
    await supabase.from("user_regions").delete().eq("trip_id", trip.id);
    const { data, error } = await supabase.from("trips").delete().eq("id", trip.id).select();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("삭제 권한이 없어요. 마스터 계정이거나 본인이 만든 여행만 삭제할 수 있습니다.");
      return;
    }
    setTrips((prev) => prev.filter((t) => t.id !== trip.id));
    setUserRegions((prev) => prev.filter((r) => r.tripId !== trip.id));
    if (activeTripId === trip.id) selectTrip(DEFAULT_TRIP.id);
  }

  function canManageRegion(region) {
    return isMaster || (!!identity && region.userId === identity.id);
  }

  async function addSpot(region, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newSpots = [...(region.moreSpots || []), { name: trimmed }];
    const { data, error } = await supabase.from("user_regions").update({ spots: newSpots }).eq("id", region.id).select().single();
    if (error) {
      alert("추가에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function deleteSpot(region, index) {
    const newSpots = (region.moreSpots || []).filter((_, i) => i !== index);
    const { data, error } = await supabase.from("user_regions").update({ spots: newSpots }).eq("id", region.id).select().single();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function deleteRegion(region) {
    if (!window.confirm(`"${region.kr}" 지역을 삭제할까요?`)) return;
    // RLS가 막으면 에러 없이 0건 삭제로 조용히 끝날 수 있어서, select()로 실제 삭제된
    // 행을 돌려받아 확인합니다. 확인 없이 로컬 상태만 지우면 화면에서 잠깐 사라졌다가
    // 실시간 구독이 다시 불러오면서 그대로 남아있는 것처럼 보이는 문제가 있었습니다.
    const { data, error } = await supabase.from("user_regions").delete().eq("id", region.id).select();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("삭제 권한이 없어요. 마스터 계정이거나 본인이 만든 지역만 삭제할 수 있습니다.");
      return;
    }
    setUserRegions((prev) => prev.filter((r) => r.id !== region.id));
    setActive(0);
  }

  function locateItem(point) {
    setFocus(point);
    setZoomed(true);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleMore() {
    setShowMore((prev) => {
      const next = !prev;
      if (!next && active >= baseRegions.length) setActive(0);
      return next;
    });
  }

  return (
    <div className="min-h-screen w-full" style={{ background: "#FFFFFF" }}>
      <div className="max-w-md mx-auto px-4 pt-8 pb-16">
        <UserBadge canShare={canShareActiveTrip} isShared={!!activeTrip.is_shared} onToggleShare={toggleShareTrip} />
        <div className="mb-4 anim-fadeup">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "#0EA5E9" }}>
              {activeTrip.subtitle || "TRIP"}
            </p>
            <TripSwitcher
              trips={allTrips}
              activeTripId={activeTripId}
              onSelect={selectTrip}
              onSave={saveTrip}
              canDelete={canDeleteTrip}
              onDelete={deleteTrip}
            />
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
          moreCount={extraRegions.length}
          baseCount={baseRegions.length}
        />

        <button
          className="text-xs mb-4 -mt-3 flex items-center gap-1"
          style={{ color: "#5B7A90", fontWeight: 700 }}
          onClick={() => setShowAddForm(true)}
        >
          + 새 지역 추가
        </button>

        {loadingRegions ? (
          <div className="flex justify-center mt-8">
            <Spinner size={22} />
          </div>
        ) : regions.length === 0 ? (
          <p className="text-[13px] text-center mt-8" style={{ color: "#94A9B8" }}>
            이 여행에는 아직 지역이 없어요. 위의 &quot;+ 새 지역 추가&quot;로 시작해보세요.
          </p>
        ) : (
          <>
            <RegionHeader
              region={region}
              onDelete={canManageRegion(region) ? () => deleteRegion(region) : undefined}
            />
            {region.flight && <FlightCard flight={region.flight} />}
            <SpotsPanel
              spots={region.moreSpots}
              open={showSpots}
              onToggle={() => setShowSpots((v) => !v)}
              onLocateSpot={locateItem}
              canEdit={canManageRegion(region)}
              onAddSpot={(name) => addSpot(region, name)}
              onDeleteSpot={(i) => deleteSpot(region, i)}
            />
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
              setUserRegions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, toRegion(row)]));
              if (isDefaultTrip) setShowMore(true);
            }}
          />
        )}
{/* 
        {isDefaultTrip && (
          <p className="text-[11px] mt-6 text-center" style={{ color: "#94A9B8" }}>
            항공 노선·운항 스케줄은 예약 전 항공사 홈페이지에서 재확인해주세요
          </p>
        )} */}
      </div>
    </div>
  );
}
