"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Planner(지역 목록)와 DayCards(일정 수정 기록/메모)가 각자 따로 구현하던 "단일 컬럼으로
// 좁혀서 초기 로드 → postgres_changes 아무 이벤트에나 재조회 → unmount 시 채널 해제"
// 패턴을 하나로 모읍니다. trips 로딩(useTrips)은 이 훅을 쓰지 않습니다 — INSERT 이벤트만
// 보고 재조회 대신 로컬 배열에 낙관적으로 append하는 다른 모양이라 억지로 맞추면 오히려
// 복잡해집니다.
//
// subscriptionFilter를 안 주면(day_item_edits 제외) 테이블 전체를 필터 없이 구독합니다:
// DELETE 이벤트는 기본 REPLICA IDENTITY에서 기본키만 실려오고 나머지 컬럼은 빠져서,
// filterColumn 기준으로 구독 필터를 걸면 삭제 이벤트가 조용히 무시됩니다. load()가 어차피
// filterColumn/filterValue로 다시 좁혀서 가져오므로 결과 자체는 정확하고, 다른
// 트립/지역에서 일어난 변경으로 재조회가 한 번 더 일어나는 정도의 비용만 남습니다.
export function useRealtimeQuery({
  table,
  filterColumn,
  filterValue,
  order,
  channelName,
  subscriptionFilter,
  transform = (rows) => rows,
  enabled = true,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    async function load() {
      let query = supabase.from(table).select("*");
      if (filterColumn) query = query.eq(filterColumn, filterValue);
      if (order) query = query.order(order);
      const { data: rows } = await query;
      if (alive) {
        setData(transform(rows || []));
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(subscriptionFilter ? { filter: subscriptionFilter } : {}) },
        load
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterColumn, filterValue, order, channelName, subscriptionFilter, enabled]);

  return { data, setData, loading };
}
