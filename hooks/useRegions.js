"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

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

export function toRegion(row) {
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

// 트립이 늘어날수록, 예전처럼 트립 필터 없이 user_regions 테이블 전체(지역별
// days/spots jsonb 포함)를 매번 받아오면 다른 사람의 트립 데이터까지 모든 클라이언트가
// 계속 다운로드하게 됩니다. 조회를 활성 트립으로 좁혀서 실제로 보고 있는 트립의
// 지역만 받아옵니다.
export function useRegions(activeTripId, { onRegionDeleted } = {}) {
  const {
    data: userRegions,
    setData: setUserRegions,
    loading: loadingRegions,
  } = useRealtimeQuery({
    table: "user_regions",
    filterColumn: "trip_id",
    filterValue: activeTripId,
    order: "created_at",
    channelName: `user_regions_feed:${activeTripId}`,
    transform: (rows) => sortRegionRows(rows).map(toRegion),
    enabled: !!activeTripId,
  });

  // addSpot/deleteSpot/.../saveParticipants가 전부 "patch 만들기 → user_regions
  // update → 에러면 alert → 로컬 상태 갱신"만 반복하므로 한 곳으로 모읍니다.
  async function updateRegion(regionId, patch, errorMessage) {
    const { data, error } = await supabase.from("user_regions").update(patch).eq("id", regionId).select().single();
    if (error) {
      alert(errorMessage + ": " + error.message);
      return null;
    }
    setUserRegions((prev) => prev.map((r) => (r.id === data.id ? toRegion(data) : r)));
    return data;
  }

  async function addSpot(region, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newSpots = [...(region.moreSpots || []), { name: trimmed }];
    await updateRegion(region.id, { spots: newSpots }, "추가에 실패했어요");
  }

  async function deleteSpot(region, index) {
    const newSpots = (region.moreSpots || []).filter((_, i) => i !== index);
    await updateRegion(region.id, { spots: newSpots }, "삭제에 실패했어요");
  }

  async function setSpotLocation(region, index, point) {
    const newSpots = (region.moreSpots || []).map((s, i) =>
      i === index ? { name: s.name, lat: point?.lat ?? null, lng: point?.lng ?? null } : s
    );
    await updateRegion(region.id, { spots: newSpots }, "위치 저장에 실패했어요");
  }

  // 지역 음식은 명소와 달리 위치가 필요 없습니다. AI 생성 시 붙는 사진(imageUrl)은
  // 여기서 직접 추가할 때는 안 붙습니다(이름만 저장 — FoodsPanel이 그대로 표시함).
  async function addFood(region, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newFoods = [...(region.foods || []), { name: trimmed }];
    await updateRegion(region.id, { foods: newFoods }, "추가에 실패했어요");
  }

  async function deleteFood(region, index) {
    const newFoods = (region.foods || []).filter((_, i) => i !== index);
    await updateRegion(region.id, { foods: newFoods }, "삭제에 실패했어요");
  }

  async function saveRegionDates(region, startDate, endDate) {
    await updateRegion(region.id, { start_date: startDate, end_date: endDate }, "날짜 저장에 실패했어요");
  }

  async function saveRegionMemo(region, memo) {
    await updateRegion(region.id, { memo }, "메모 저장에 실패했어요");
  }

  async function addBudgetItem(region, item) {
    if (!item.name?.trim()) return;
    const newBudget = [...(region.budget || []), item];
    await updateRegion(region.id, { budget: newBudget }, "추가에 실패했어요");
  }

  async function deleteBudgetItem(region, index) {
    const newBudget = (region.budget || []).filter((_, i) => i !== index);
    await updateRegion(region.id, { budget: newBudget }, "삭제에 실패했어요");
  }

  async function saveParticipants(region, participants) {
    await updateRegion(region.id, { participants }, "참가자 저장에 실패했어요");
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
    onRegionDeleted?.();
  }

  return {
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
    deleteRegion,
  };
}
