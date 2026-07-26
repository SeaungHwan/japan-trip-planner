"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity, checkIsMaster } from "@/lib/auth";
import UserBadge from "@/components/UserBadge";
import Spinner from "@/components/Spinner";
import MapView from "@/components/MapView";
import RegionChips from "@/components/RegionChips";
import RegionHeader from "@/components/RegionHeader";
import RegionDateButton, { formatRange } from "@/components/RegionDateButton";
import FlightCard from "@/components/FlightCard";
import SpotsPanel from "@/components/SpotsPanel";
import FoodsPanel from "@/components/FoodsPanel";
import ModeToggle from "@/components/ModeToggle";
import DayCards from "@/components/DayCards";
import TripSwitcher from "@/components/TripSwitcher";

const AddRegionForm = dynamic(() => import("@/components/AddRegionForm"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-6">
      <Spinner size={20} />
    </div>
  ),
});

const MAX_BASE_REGIONS = 6;
const LAST_TRIP_KEY = "japan-trip-planner:lastTripId";
// 트립이 하나도 없거나 아직 안 골랐을 때 쓰는 빈 자리표시자입니다. "기본 여행" 같은
// 실제 트립 취급을 받지 않고(id가 없어서 DB에 아무것도 매치되지 않음), 렌더링이
// undefined 접근으로 깨지지 않게만 해줍니다.
const EMPTY_TRIP = {
  id: null,
  title: "",
  subtitle: "",
  is_shared: false,
  shared_editable: false,
  user_id: null,
  start_date: null,
  end_date: null,
};

function readLastTripId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_TRIP_KEY) || null;
}

// sort_order가 없던(한 번도 순서를 안 바꾼) 지역은 지금까지처럼 created_at 순서를
// 그대로 유지하고, sort_order가 있는 지역은 그 값 기준으로 앞에 옵니다. 두 종류가
// 섞여 있으면(예: 순서를 바꾼 뒤 새 지역을 추가한 경우) sort_order가 있는 쪽이 항상
// 앞에 오고, 없는 쪽끼리는 원래(created_at) 순서를 유지합니다.
function sortRegionRows(rows) {
  return [...rows].sort((a, b) => {
    const aHas = a.sort_order != null;
    const bHas = b.sort_order != null;
    if (aHas && bHas) return a.sort_order - b.sort_order;
    if (aHas) return -1;
    if (bHas) return 1;
    return 0;
  });
}

function toRegion(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    kr: row.kr,
    jp: row.jp || "",
    icon: row.icon || "landmark",
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    flight: row.flight || null,
    moreSpots: (row.spots || []).map((s) => (typeof s === "string" ? { name: s } : s)),
    foods: row.foods || [],
    memo: row.memo || "",
    budget: row.budget || [],
    participants: row.participants || [],
    days: row.days || [],
    userId: row.user_id || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
  };
}

export default function Planner() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("transit");
  const [showMore, setShowMore] = useState(false);
  const [showSpots, setShowSpots] = useState(false);
  const [showFoods, setShowFoods] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [focus, setFocus] = useState(null);
  const [dayPins, setDayPins] = useState([]);
  const [showAllDayPins, setShowAllDayPins] = useState(false);
  const [userRegions, setUserRegions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(readLastTripId);
  const [identity, setIdentity] = useState(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(true);

  useEffect(() => {
    getIdentity().then(setIdentity);
    checkIsMaster().then(setIsMaster);
  }, []);

  // 트립이 늘어날수록, 예전처럼 트립 필터 없이 user_regions 테이블 전체(지역별
  // days/spots jsonb 포함)를 매번 받아오면 다른 사람의 트립 데이터까지 모든 클라이언트가
  // 계속 다운로드하게 됩니다. 조회를 활성 트립으로 좁혀서 실제로 보고 있는 트립의
  // 지역만 받아옵니다.
  useEffect(() => {
    if (!activeTripId) {
      setUserRegions([]);
      setLoadingRegions(false);
      return;
    }

    let active = true;
    setLoadingRegions(true);

    async function load() {
      const { data } = await supabase
        .from("user_regions")
        .select("*")
        .eq("trip_id", activeTripId)
        .order("created_at", { ascending: true });
      if (active) {
        setUserRegions(sortRegionRows(data || []).map(toRegion));
        setLoadingRegions(false);
      }
    }
    load();

    // day_item_notes와 같은 이유로 구독 자체엔 trip_id 필터를 걸지 않습니다: DELETE
    // 이벤트는 기본 REPLICA IDENTITY에서 기본키만 실려오고 trip_id는 빠져서, 필터를
    // 걸면 삭제 이벤트가 조용히 무시됩니다. load()가 이미 activeTripId로 좁혀서 다시
    // 받아오므로, 다른 트립에서 일어난 변경으로 재조회가 한 번 더 일어나는 정도의
    // 비용만 남고 결과 자체는 정확합니다.
    const channel = supabase
      .channel(`user_regions_feed:${activeTripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_regions" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [activeTripId]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: true });
      if (active) {
        setTrips(data || []);
        setTripsLoaded(true);
      }
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

  const activeTrip = trips.find((t) => t.id === activeTripId) || EMPTY_TRIP;

  // 마지막으로 보던 여행이 삭제됐거나 더 이상 접근 권한이 없으면(비공개로 바뀜 등)
  // 남은 여행 중 첫 번째로 되돌립니다(없으면 빈 상태). trips가 다 로드되기 전(빈 배열)에는
  // 판단하지 않습니다.
  useEffect(() => {
    if (!tripsLoaded) return;
    if (activeTripId && trips.some((t) => t.id === activeTripId)) return;
    setActiveTripId(trips[0]?.id ?? null);
  }, [tripsLoaded, trips, activeTripId]);

  useEffect(() => {
    if (activeTripId) localStorage.setItem(LAST_TRIP_KEY, activeTripId);
    else localStorage.removeItem(LAST_TRIP_KEY);
  }, [activeTripId]);

  // 처음 만들어진 순서(created_at 오름차순)로 앞의 MAX_BASE_REGIONS개만 메인 스크롤에 두고
  // 나머지는 전부 "더보기"로 넘깁니다. 그래서 새로 추가한 지역은 항상 더보기 쪽에 들어가고,
  // 지역별로 is_extra를 일일이 설정/관리할 필요가 없습니다. userRegions는 이제 위
  // useEffect에서 이미 activeTripId로 좁혀서 가져오므로, 여기서 다시 트립으로 거를
  // 필요가 없습니다.
  const { baseRegions, extraRegions } = useMemo(() => {
    return {
      baseRegions: userRegions.slice(0, MAX_BASE_REGIONS),
      extraRegions: userRegions.slice(MAX_BASE_REGIONS),
    };
  }, [userRegions]);
  const regions = showMore ? baseRegions.concat(extraRegions) : baseRegions;
  const region = regions[active];

  const selectRegion = useCallback((i) => {
    setActive(i);
    setShowSpots(false);
    setShowFoods(false);
    setZoomed(true);
    setFocus(null);
    setShowAllDayPins(false);
  }, []);

  // 메인 칩 줄(baseRegions)에서만 순서를 바꿀 수 있습니다 — userRegions의 앞
  // MAX_BASE_REGIONS개가 그대로 baseRegions라, 이 구간 안에서만 arrayMove하면 됩니다.
  // 낙관적으로 화면부터 바꾸고, 그 순서(index)를 sort_order로 저장합니다. 드래그하던
  // 지역이 활성 지역이었다면 순서가 바뀐 뒤에도 같은 지역이 계속 선택되도록 active를
  // 그 지역의 새 위치로 다시 맞춥니다.
  const reorderRegions = useCallback(
    (oldIndex, newIndex) => {
      const base = userRegions.slice(0, MAX_BASE_REGIONS);
      const extra = userRegions.slice(MAX_BASE_REGIONS);
      const newBase = arrayMove(base, oldIndex, newIndex);
      const activeId = regions[active]?.id;

      setUserRegions([...newBase, ...extra]);
      if (activeId) {
        const newActiveIndex = newBase.findIndex((r) => r.id === activeId);
        if (newActiveIndex !== -1) setActive(newActiveIndex);
      }

      Promise.all(newBase.map((r, idx) => supabase.from("user_regions").update({ sort_order: idx }).eq("id", r.id)));
    },
    [userRegions, active, regions]
  );

  // LeafletMap을 React.memo로 감싸도, 이 핸들러들이 렌더마다 새로 만들어지는 인라인
  // 화살표 함수면 props가 매번 다른 참조가 되어 memo가 무력화됩니다(예: 명소/음식
  // 패널을 열고 닫을 때마다 지도 전체가 다시 계산·렌더링됨). useCallback으로 고정합니다.
  const onZoomOut = useCallback(() => {
    setZoomed(false);
    setFocus(null);
  }, []);

  const onToggleAllDayPins = useCallback(() => {
    setShowAllDayPins((v) => !v);
  }, []);

  function selectTrip(id) {
    setActiveTripId(id);
    setActive(0);
    setShowMore(false);
    setShowSpots(false);
    setShowFoods(false);
    setZoomed(false);
    setFocus(null);
    setShowAllDayPins(false);
  }

  async function saveTrip(id, title, subtitle, startDate, endDate) {
    const tripIdentity = await getIdentity();
    if (!tripIdentity) return;
    const tripId = id || crypto.randomUUID();
    const { data } = await supabase
      .from("trips")
      .upsert(
        {
          id: tripId,
          title,
          subtitle: subtitle || null,
          start_date: startDate || null,
          end_date: endDate || null,
          created_by: tripIdentity.nickname,
          user_id: tripIdentity.id,
        },
        { onConflict: "id" }
      )
      .select()
      .single();
    if (data) {
      setTrips((prev) => (prev.some((t) => t.id === data.id) ? prev.map((t) => (t.id === data.id ? data : t)) : [...prev, data]));
      selectTrip(data.id);
    }
  }

  function canDeleteTrip(trip) {
    return isMaster || (identity && trip.user_id === identity.id);
  }

  // 여행 공유 여부는 만든 사람만 바꿀 수 있습니다 — 마스터도 예외 없습니다.
  const canShareActiveTrip = !!identity && activeTrip.user_id === identity.id;

  const activeTripShareLevel = !activeTrip.is_shared ? "private" : activeTrip.shared_editable ? "edit" : "view";

  async function setTripShareLevel(level) {
    const patch =
      level === "edit"
        ? { is_shared: true, shared_editable: true }
        : level === "view"
        ? { is_shared: true, shared_editable: false }
        : { is_shared: false, shared_editable: false };
    const { data, error } = await supabase.from("trips").update(patch).eq("id", activeTrip.id).select().single();
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
    if (activeTripId === trip.id) {
      const remaining = trips.filter((t) => t.id !== trip.id);
      selectTrip(remaining[0]?.id ?? null);
    }
  }

  // 트립 소유자가 "편집까지 공유"를 켰다면, 그 트립에 속한 지역은 소유자 본인이 아니어도
  // (마스터가 아니어도) 관리할 수 있습니다. DB의 trip_shared_editable() 정책과 동일한 규칙입니다.
  function canEditTrip(trip) {
    if (!trip.id) return false;
    return isMaster || (!!identity && trip.user_id === identity.id) || (!!trip.is_shared && !!trip.shared_editable);
  }

  function canManageRegion(region) {
    return isMaster || (!!identity && region.userId === identity.id) || canEditTrip(activeTrip);
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

  async function setSpotLocation(region, index, point) {
    const newSpots = (region.moreSpots || []).map((s, i) =>
      i === index ? { name: s.name, lat: point?.lat ?? null, lng: point?.lng ?? null } : s
    );
    const { data, error } = await supabase.from("user_regions").update({ spots: newSpots }).eq("id", region.id).select().single();
    if (error) {
      alert("위치 저장에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  // 지역 음식은 명소와 달리 위치가 필요 없어서 이름 문자열만 다룹니다.
  async function addFood(region, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newFoods = [...(region.foods || []), trimmed];
    const { data, error } = await supabase.from("user_regions").update({ foods: newFoods }).eq("id", region.id).select().single();
    if (error) {
      alert("추가에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function deleteFood(region, index) {
    const newFoods = (region.foods || []).filter((_, i) => i !== index);
    const { data, error } = await supabase.from("user_regions").update({ foods: newFoods }).eq("id", region.id).select().single();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function saveRegionDates(region, startDate, endDate) {
    const { data, error } = await supabase
      .from("user_regions")
      .update({ start_date: startDate, end_date: endDate })
      .eq("id", region.id)
      .select()
      .single();
    if (error) {
      alert("날짜 저장에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function saveRegionMemo(region, memo) {
    const { data, error } = await supabase.from("user_regions").update({ memo }).eq("id", region.id).select().single();
    if (error) {
      alert("메모 저장에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function addBudgetItem(region, item) {
    if (!item.name?.trim()) return;
    const newBudget = [...(region.budget || []), item];
    const { data, error } = await supabase.from("user_regions").update({ budget: newBudget }).eq("id", region.id).select().single();
    if (error) {
      alert("추가에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function deleteBudgetItem(region, index) {
    const newBudget = (region.budget || []).filter((_, i) => i !== index);
    const { data, error } = await supabase.from("user_regions").update({ budget: newBudget }).eq("id", region.id).select().single();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
  }

  async function saveParticipants(region, participants) {
    const { data, error } = await supabase.from("user_regions").update({ participants }).eq("id", region.id).select().single();
    if (error) {
      alert("참가자 저장에 실패했어요: " + error.message);
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

  function toggleMore() {
    setShowMore((prev) => {
      const next = !prev;
      if (!next && active >= baseRegions.length) setActive(0);
      return next;
    });
  }

  return (
    <div className="app-scroll w-full" style={{ background: "#FFFFFF" }}>
      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-10 pb-4">
        <div className="md:sticky md:top-0 md:z-10 md:bg-white md:pt-4 md:pb-2">
          <UserBadge
            canShare={canShareActiveTrip}
            shareLevel={activeTripShareLevel}
            onSetShareLevel={setTripShareLevel}
            weatherLat={region?.lat}
            weatherLng={region?.lng}
            startDate={region?.startDate || activeTrip.start_date}
            endDate={region?.endDate || activeTrip.end_date}
          />
          <div className="mb-2 anim-fadeup">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "#0EA5E9" }}>
                  {(region?.startDate && formatRange(region.startDate, region.endDate)) || activeTrip.subtitle || "TRIP"}
                </p>
                {region && (
                  <RegionDateButton
                    region={region}
                    canEdit={canManageRegion(region)}
                    onSaveDates={(startDate, endDate) => saveRegionDates(region, startDate, endDate)}
                  />
                )}
              </div>
              <TripSwitcher
                trips={trips}
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
        </div>

        {!tripsLoaded ? (
          <div className="flex justify-center mt-8">
            <Spinner size={22} />
          </div>
        ) : !activeTrip.id ? (
          <p className="text-[13px] text-center mt-8" style={{ color: "#94A9B8" }}>
            아직 여행이 없어요. 오른쪽 위 &quot;다른 여행&quot;에서 새 여행을 만들어보세요.
          </p>
        ) : (
          <>
            <div className="md:flex md:items-start md:gap-4">
              <div className="md:flex-1 md:min-w-0 md:sticky md:top-40">
                <MapView
                  regions={regions}
                  active={active}
                  zoomed={zoomed}
                  onSelect={selectRegion}
                  onZoomOut={onZoomOut}
                  focus={focus}
                  dayPins={dayPins}
                  showAllDayPins={showAllDayPins}
                  onToggleAllDayPins={onToggleAllDayPins}
                />

                <RegionChips
                  regions={regions}
                  active={active}
                  onSelect={selectRegion}
                  showMore={showMore}
                  onToggleMore={toggleMore}
                  moreCount={extraRegions.length}
                  baseCount={baseRegions.length}
                  canAddRegion={canEditTrip(activeTrip)}
                  onAddRegion={() => setShowAddForm(true)}
                  canReorder={canEditTrip(activeTrip)}
                  onReorder={reorderRegions}
                />

                {loadingRegions ? (
                  <div className="flex justify-center mt-8">
                    <Spinner size={22} />
                  </div>
                ) : regions.length === 0 ? (
                  <p className="text-[13px] text-center mt-8" style={{ color: "#94A9B8" }}>
                    이 여행에는 아직 지역이 없어요.
                    {canEditTrip(activeTrip) && ` 위의 "+ 새 지역 추가"로 시작해보세요.`}
                  </p>
                ) : (
                  <RegionHeader
                    region={region}
                    onDelete={canManageRegion(region) ? () => deleteRegion(region) : undefined}
                    canEdit={canManageRegion(region)}
                    onAddBudgetItem={(item) => addBudgetItem(region, item)}
                    onDeleteBudgetItem={(i) => deleteBudgetItem(region, i)}
                    onSaveParticipants={(participants) => saveParticipants(region, participants)}
                    memo={region.memo}
                    onSaveMemo={(memo) => saveRegionMemo(region, memo)}
                  />
                )}
              </div>

              {!loadingRegions && regions.length > 0 && (
                <div className="md:flex-1 md:min-w-0">
                  {region.flight && <FlightCard flight={region.flight} />}
                  <div className="flex gap-2 mb-3">
                    <SpotsPanel
                      spots={region.moreSpots}
                      open={showSpots}
                      onToggle={() => setShowSpots((v) => !v)}
                      canEdit={canManageRegion(region)}
                      onAddSpot={(name) => addSpot(region, name)}
                      onDeleteSpot={(i) => deleteSpot(region, i)}
                      onSetLocation={(i, point) => setSpotLocation(region, i, point)}
                    />
                    <FoodsPanel
                      foods={region.foods}
                      open={showFoods}
                      onToggle={() => setShowFoods((v) => !v)}
                      canEdit={canManageRegion(region)}
                      onAddFood={(name) => addFood(region, name)}
                      onDeleteFood={(i) => deleteFood(region, i)}
                    />
                  </div>
                  {region.days?.length > 0 && (
                    <>
                      <ModeToggle mode={mode} onChange={setMode} />
                      <DayCards
                        days={region.days}
                        mode={mode}
                        regionId={region.id}
                        regionName={region.kr}
                        onDaysPinsChange={setDayPins}
                        canEdit={canManageRegion(region)}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {showAddForm && (
              <AddRegionForm
                tripId={activeTripId}
                onClose={() => setShowAddForm(false)}
                onAdded={(row) => {
                  setUserRegions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, toRegion(row)]));
                  setShowMore(true);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
