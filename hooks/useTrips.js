"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";

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

// 트립 목록/선택/공유설정/CRUD를 다룹니다. onSwitch는 사용자가 직접 트립을 바꾼
// 경우에만(수동 전환, 저장 후 자동 이동, 삭제 후 남은 트립으로 이동) 호출되고, "보던
// 트립이 사라져서 첫 번째로 되돌리는" 수동 개입이 없는 자동 보정 시점에는 호출되지
// 않습니다 — Planner가 이 콜백으로 지역 선택 화면 상태(active/zoomed 등)를 리셋합니다.
export function useTrips({ identity, isMaster, onSwitch, onDeleted }) {
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(readLastTripId);

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
  // 판단하지 않습니다. 사용자가 직접 고른 전환이 아니라서 onSwitch는 부르지 않습니다.
  useEffect(() => {
    if (!tripsLoaded) return;
    if (activeTripId && trips.some((t) => t.id === activeTripId)) return;
    setActiveTripId(trips[0]?.id ?? null);
  }, [tripsLoaded, trips, activeTripId]);

  useEffect(() => {
    if (activeTripId) localStorage.setItem(LAST_TRIP_KEY, activeTripId);
    else localStorage.removeItem(LAST_TRIP_KEY);
  }, [activeTripId]);

  function switchTrip(id) {
    setActiveTripId(id);
    onSwitch?.();
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
      switchTrip(data.id);
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
    onDeleted?.(trip);
    if (activeTripId === trip.id) {
      const remaining = trips.filter((t) => t.id !== trip.id);
      switchTrip(remaining[0]?.id ?? null);
    }
  }

  // 트립 소유자가 "편집까지 공유"를 켰다면, 그 트립에 속한 지역은 소유자 본인이 아니어도
  // (마스터가 아니어도) 관리할 수 있습니다. DB의 trip_shared_editable() 정책과 동일한 규칙입니다.
  function canEditTrip(trip) {
    if (!trip.id) return false;
    return isMaster || (!!identity && trip.user_id === identity.id) || (!!trip.is_shared && !!trip.shared_editable);
  }

  return {
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
  };
}
