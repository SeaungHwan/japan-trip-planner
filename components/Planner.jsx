"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "@/lib/supabaseClient";
import { useIdentity } from "@/hooks/useIdentity";
import { useTrips } from "@/hooks/useTrips";
import { useRegions, toRegion } from "@/hooks/useRegions";
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
import AIEditRegionModal from "@/components/AIEditRegionModal";

const AddRegionForm = dynamic(() => import("@/components/AddRegionForm"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-6">
      <Spinner size={20} />
    </div>
  ),
});

const MAX_BASE_REGIONS = 6;

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAIEdit, setShowAIEdit] = useState(false);
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const { identity, isMaster } = useIdentity();

  // 트립이 바뀌면(수동 전환/저장 후 자동 이동/삭제 후 남은 트립으로 이동) 지역 선택과
  // 관련된 화면 상태를 초기 상태로 되돌립니다. "보던 트립이 사라져서 자동으로 첫
  // 트립으로 되돌리는" 경우에는 이 콜백이 불리지 않습니다(useTrips 내부에서 직접 처리).
  const resetRegionSelectionView = useCallback(() => {
    setActive(0);
    setShowMore(false);
    setShowSpots(false);
    setShowFoods(false);
    setZoomed(false);
    setFocus(null);
    setShowAllDayPins(false);
    setShowAIEdit(false);
  }, []);

  // onDeleted가 참조하는 setUserRegions는 아래 useRegions()에서 정의되지만, 실제로
  // 호출되는 시점(트립 삭제가 성공했을 때)엔 이미 할당이 끝난 뒤라 문제없습니다.
  const {
    trips,
    tripsLoaded,
    activeTripId,
    activeTrip,
    switchTrip,
    saveTrip,
    deleteTrip,
    setTripShareLevel,
    canDeleteTrip,
    canEditTrip,
    canShareActiveTrip,
    activeTripShareLevel,
  } = useTrips({
    identity,
    isMaster,
    onSwitch: resetRegionSelectionView,
    onDeleted: (trip) => setUserRegions((prev) => prev.filter((r) => r.tripId !== trip.id)),
  });

  const {
    userRegions,
    setUserRegions,
    loadingRegions,
    addSpot,
    deleteSpot,
    setSpotLocation,
    addFood,
    deleteFood,
    saveRegionDates,
    saveRegionMemo,
    addBudgetItem,
    deleteBudgetItem,
    saveParticipants,
    applyAIEdit,
    deleteRegion,
  } = useRegions(activeTripId, { onRegionDeleted: () => setActive(0) });

  // 왼쪽 영역(지도 등)이 데스크톱에서 고정될 때, 위 헤더(사용자 정보+날짜/제목) 바로
  // 아래에 딱 붙게 하려고 헤더의 실제 렌더링 높이를 재서 그 값을 sticky 위치로 씁니다.
  // 숫자를 고정해두면(예: top-40) 헤더 높이가 조금만 바뀌어도(제목 줄바꿈 등) 여백이
  // 벌어지거나 겹치는 문제가 생겨서, ResizeObserver로 항상 실제 높이에 맞춥니다.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // ResizeObserver의 entry.contentRect는 패딩을 뺀 content-box 크기라, 헤더에 준
    // pt-6/md:pb-2 패딩만큼 실제 보이는 높이보다 작게 나옵니다. 화면에 실제로 차지하는
    // 높이(패딩 포함 border-box)를 그대로 써야 해서 getBoundingClientRect로 잽니다.
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 처음 만들어진 순서(created_at 오름차순)로 앞의 MAX_BASE_REGIONS개만 메인 스크롤에 두고
  // 나머지는 전부 "더보기"로 넘깁니다. 그래서 새로 추가한 지역은 항상 더보기 쪽에 들어가고,
  // 지역별로 is_extra를 일일이 설정/관리할 필요가 없습니다. userRegions는 이미 useRegions
  // 안에서 activeTripId로 좁혀서 가져오므로, 여기서 다시 트립으로 거를 필요가 없습니다.
  const { baseRegions, extraRegions } = useMemo(() => {
    return {
      baseRegions: userRegions.slice(0, MAX_BASE_REGIONS),
      extraRegions: userRegions.slice(MAX_BASE_REGIONS),
    };
  }, [userRegions]);
  // .concat()이 매 렌더마다 새 배열을 만들면 이 배열을 그대로 받는 memo(LeafletMap)의
  // 얕은 비교가 깨져서, "더보기"가 펼쳐진 동안은 지도와 무관한 상태가 바뀔 때마다
  // (명소 패널 열기, 일정 편집 등) 지도 전체가 다시 계산됩니다. baseRegions/extraRegions가
  // 실제로 바뀔 때만 새 배열을 만들도록 메모이즈합니다.
  const regions = useMemo(
    () => (showMore ? baseRegions.concat(extraRegions) : baseRegions),
    [showMore, baseRegions, extraRegions]
  );
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
    [userRegions, active, regions, setUserRegions]
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

  function canManageRegion(region) {
    return isMaster || (!!identity && region.userId === identity.id) || canEditTrip(activeTrip);
  }

  function toggleMore() {
    setShowMore((prev) => {
      const next = !prev;
      if (!next && active >= baseRegions.length) setActive(0);
      return next;
    });
  }

  return (
    <div className="app-scroll w-full bg-white">
      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pb-4">
        <div ref={headerRef} className="md:sticky md:top-0 md:z-10 md:bg-white pt-6 md:pb-2">
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
                <p className="text-xs tracking-[0.3em] uppercase text-sky">
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
                onSelect={switchTrip}
                onSave={saveTrip}
                canDelete={canDeleteTrip}
                onDelete={deleteTrip}
              />
            </div>
            <h1 className="text-3xl mt-1 serif text-ink font-bold">
              {activeTrip.title}
            </h1>
          </div>
        </div>

        {!tripsLoaded ? (
          <div className="flex justify-center mt-8">
            <Spinner size={22} />
          </div>
        ) : !activeTrip.id ? (
          <p className="text-[13px] text-center mt-8 text-faint">
            아직 여행이 없어요. 오른쪽 위 &quot;다른 여행&quot;에서 새 여행을 만들어보세요.
          </p>
        ) : (
          <>
            <div className="md:flex md:items-start md:gap-4">
              <div className="md:flex-1 md:min-w-0 md:sticky" style={{ top: headerHeight }}>
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
                  <p className="text-[13px] text-center mt-8 text-faint">
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
                        onOpenAIEdit={() => setShowAIEdit(true)}
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

            {showAIEdit && (
              <AIEditRegionModal
                region={region}
                onClose={() => setShowAIEdit(false)}
                onApply={(result) => applyAIEdit(region, result)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
