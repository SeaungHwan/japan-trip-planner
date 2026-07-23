"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Pencil, Trash2, Plus, GripVertical, ArrowUpDown, MapPin, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { checkIsMaster } from "@/lib/auth";

const SKY = "#0EA5E9";
const CUSTOM_DAY_BASE = 100000;

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 180, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

function mergeItems(baseItems, edits) {
  const editMap = new Map(edits.map((e) => [e.item_key, e]));
  const merged = [];

  baseItems.forEach((text, i) => {
    const key = `base:${i}`;
    const e = editMap.get(key);
    if (e?.deleted) return;
    merged.push({ key, text: e ? e.text : text, sortOrder: e ? e.sort_order : i, lat: e?.lat ?? null, lng: e?.lng ?? null });
  });

  edits
    .filter((e) => e.item_key.startsWith("custom:") && !e.deleted)
    .forEach((e) => merged.push({ key: e.item_key, text: e.text, sortOrder: e.sort_order, lat: e.lat ?? null, lng: e.lng ?? null }));

  merged.sort((a, b) => a.sortOrder - b.sortOrder);
  return merged;
}

function orderBetween(before, after) {
  if (before == null && after == null) return 0;
  if (before == null) return after - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

export default function DayCards({ days, mode, regionId, onLocateItem }) {
  const [edits, setEdits] = useState([]);
  const [editingDay, setEditingDay] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newText, setNewText] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dragOverPos, setDragOverPos] = useState(null);
  const [locatingItem, setLocatingItem] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const dragPosRef = useRef(null);
  const cardRefs = useRef({});
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    checkIsMaster().then(setCanEdit);
  }, []);

  useEffect(() => {
    if (editingDay !== null) cardRefs.current[editingDay]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editingDay]);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.from("day_item_edits").select("*").eq("region_id", regionId);
      if (alive) setEdits(data || []);
    }
    load();

    const channel = supabase
      .channel(`day_items:${regionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_item_edits", filter: `region_id=eq.${regionId}` },
        load
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [regionId]);

  useEffect(() => {
    setEditingDay(null);
    setDrafts({});
    setNewText("");
    setReorderMode(false);
    setLocatingItem(null);
    setPendingPoint(null);
  }, [regionId, mode]);

  function editsFor(dayIdx) {
    return edits.filter((e) => e.mode === mode && e.day_index === dayIdx);
  }

  function orderFor(dayIdx) {
    const e = edits.find((ed) => ed.mode === mode && ed.day_index === dayIdx && ed.item_key === "__order__");
    return e ? e.sort_order : dayIdx;
  }

  async function upsert(dayIdx, itemKey, patch) {
    const existing = edits.find((e) => e.mode === mode && e.day_index === dayIdx && e.item_key === itemKey);
    await supabase.from("day_item_edits").upsert(
      {
        region_id: regionId,
        mode,
        day_index: dayIdx,
        item_key: itemKey,
        text: existing?.text ?? null,
        deleted: existing?.deleted ?? false,
        sort_order: existing?.sort_order ?? 0,
        lat: existing?.lat ?? null,
        lng: existing?.lng ?? null,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "region_id,mode,day_index,item_key" }
    );
  }

  async function commitDraft(dayIdx, item) {
    const text = (drafts[item.key] ?? item.text).trim();
    if (text && text !== item.text) {
      await upsert(dayIdx, item.key, { text, sort_order: item.sortOrder });
    }
  }

  async function deleteItem(dayIdx, item) {
    await upsert(dayIdx, item.key, { deleted: true, sort_order: item.sortOrder, text: item.text });
  }

  async function addItem(dayIdx, currentItems) {
    const text = newText.trim();
    if (!text) return;
    const maxOrder = currentItems.reduce((m, it) => Math.max(m, it.sortOrder), -1);
    const key = `custom:${crypto.randomUUID()}`;
    setNewText("");
    await upsert(dayIdx, key, { text, sort_order: maxOrder + 1 });
  }

  function openLocationPicker(dayIdx, item) {
    setLocatingItem((cur) => {
      if (cur?.item.key === item.key) return null;
      return { dayIdx, item };
    });
    setPendingPoint(item.lat != null ? { lat: item.lat, lng: item.lng } : null);
  }

  async function confirmItemLocation() {
    if (!locatingItem || !pendingPoint) return;
    await upsert(locatingItem.dayIdx, locatingItem.item.key, {
      text: locatingItem.item.text,
      sort_order: locatingItem.item.sortOrder,
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
    });
    setLocatingItem(null);
    setPendingPoint(null);
  }

  async function clearItemLocation(dayIdx, item) {
    await upsert(dayIdx, item.key, { text: item.text, sort_order: item.sortOrder, lat: null, lng: null });
    setLocatingItem(null);
    setPendingPoint(null);
  }

  function titleFor(dayIdx, baseTitle) {
    const e = edits.find((ed) => ed.mode === mode && ed.day_index === dayIdx && ed.item_key === "__title__");
    return e ? e.text : baseTitle;
  }

  function isDayDeleted(dayIdx) {
    return edits.some((e) => e.mode === mode && e.day_index === dayIdx && e.item_key === "__day__" && e.deleted);
  }

  async function deleteDay(dayIdx) {
    if (!canEdit) return;
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    await upsert(dayIdx, "__day__", { deleted: true });
  }

  function toggleEditDay(dayIdx) {
    if (!canEdit) return;
    setEditingDay((cur) => (cur === dayIdx ? null : dayIdx));
    setDrafts({});
    setNewText("");
  }

  function toggleReorderMode() {
    if (!canEdit) return;
    setReorderMode((v) => !v);
    setEditingDay(null);
  }

  function planFor(di) {
    if (di < days.length) {
      const plan = days[di][mode];
      return { title: titleFor(di, plan.title), items: mergeItems(plan.items, editsFor(di)) };
    }
    return { title: titleFor(di, "새 일정"), items: mergeItems([], editsFor(di)) };
  }

  const customDayIndices = [...new Set(edits.filter((e) => e.item_key === "__custom_day__").map((e) => e.day_index))];
  const allDayIndices = days.map((_, i) => i).concat(customDayIndices);

  const visibleDays = allDayIndices
    .map((di) => ({ di, order: orderFor(di) }))
    .filter((v) => !isDayDeleted(v.di))
    .sort((a, b) => a.order - b.order);

  function reorderDay(fromPos, toPos) {
    if (fromPos === toPos) return;
    const arr = [...visibleDays];
    const [moved] = arr.splice(fromPos, 1);
    arr.splice(Math.max(0, Math.min(toPos, arr.length)), 0, moved);
    const idx = arr.indexOf(moved);
    const newOrder = orderBetween(arr[idx - 1]?.order, arr[idx + 1]?.order);
    upsert(moved.di, "__order__", { sort_order: newOrder });
  }

  async function addDay() {
    if (!canEdit) return;
    const nextIdx = customDayIndices.length ? Math.max(...customDayIndices) + 1 : CUSTOM_DAY_BASE;
    const maxOrder = visibleDays.reduce((m, v) => Math.max(m, v.order), -1);
    await upsert(nextIdx, "__custom_day__", {});
    await upsert(nextIdx, "__title__", { text: "새 일정" });
    await upsert(nextIdx, "__order__", { sort_order: maxOrder + 1 });
    setEditingDay(nextIdx);
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
      <div className="flex items-center justify-end gap-3 -mb-1">
        {visibleDays.length > 1 && (
          <button
            className="text-[12px] flex items-center gap-1"
            style={{ color: SKY, fontWeight: 700 }}
            onClick={toggleReorderMode}
          >
            <ArrowUpDown size={13} /> {reorderMode ? "완료" : "순서 수정"}
          </button>
        )}
        <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={addDay}>
          <Plus size={13} /> 일정 추가
        </button>
      </div>
      )}
      {visibleDays.map(({ di }, displayIdx) => {
        const { title, items } = planFor(di);
        const isEditing = editingDay === di;

        return (
          <div
            key={`${regionId}-${mode}-${di}`}
            ref={(el) => (cardRefs.current[di] = el)}
            draggable={reorderMode}
            onDragStart={() => {
              dragPosRef.current = displayIdx;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverPos(displayIdx);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragPosRef.current !== null) reorderDay(dragPosRef.current, displayIdx);
              dragPosRef.current = null;
              setDragOverPos(null);
            }}
            onDragEnd={() => {
              dragPosRef.current = null;
              setDragOverPos(null);
            }}
            className="day-card rounded-xl p-4"
            style={{
              animationDelay: `${displayIdx * 0.05}s`,
              background: "#FFFFFF",
              border: dragOverPos === displayIdx ? `1px solid ${SKY}` : "1px solid #BAE6FD",
            }}
          >
            <div className="flex items-start gap-3">
              {reorderMode && <GripVertical size={16} color="#94A9B8" className="shrink-0 mt-1 cursor-grab" />}
              <span
                className="text-xs shrink-0 mt-0.5 rounded-full w-6 h-6 flex items-center justify-center"
                style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
              >
                {displayIdx + 1}
              </span>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    value={drafts.__title__ ?? title}
                    onChange={(e) => setDrafts((d) => ({ ...d, __title__: e.target.value }))}
                    onBlur={() => commitDraft(di, { key: "__title__", text: title, sortOrder: 0 })}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    autoFocus
                    className="w-full text-[15px] rounded px-1.5 py-0.5"
                    style={{ border: "1px solid #BAE6FD", color: "#0F2A3D", fontWeight: 700 }}
                  />
                ) : (
                  <div className="text-[15px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                    {title}
                  </div>
                )}
                <ul
                  className="mt-1.5 space-y-1"
                  style={items.length >= 5 ? { maxHeight: 128, overflowY: "auto" } : undefined}
                >
                  {items.map((it) =>
                    isEditing ? (
                      <li key={it.key} className="flex items-center gap-1">
                        <input
                          value={drafts[it.key] ?? it.text}
                          onChange={(e) => setDrafts((d) => ({ ...d, [it.key]: e.target.value }))}
                          onBlur={() => commitDraft(di, it)}
                          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                          className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5"
                          style={{ border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                        />
                        <button
                          onClick={() => openLocationPicker(di, it)}
                          aria-label="위치 설정"
                          className="shrink-0"
                        >
                          <MapPin size={13} color={it.lat != null ? SKY : "#94A9B8"} />
                        </button>
                        <button onClick={() => deleteItem(di, it)} aria-label="항목 삭제" className="shrink-0">
                          <Trash2 size={13} color="#94A9B8" />
                        </button>
                      </li>
                    ) : it.lat != null ? (
                      <li key={it.key}>
                        <button
                          onClick={() => onLocateItem?.({ lat: it.lat, lng: it.lng, name: it.text })}
                          className="text-[13px] flex items-center gap-1 text-left"
                          style={{ color: "#5B7A90" }}
                        >
                          <MapPin size={11} color={SKY} className="shrink-0" /> {it.text}
                        </button>
                      </li>
                    ) : (
                      <li key={it.key} className="text-[13px]" style={{ color: "#5B7A90" }}>
                        &middot; {it.text}
                      </li>
                    )
                  )}
                </ul>

                {isEditing && locatingItem?.dayIdx === di && (
                  <div className="rounded-lg p-2 mt-1.5" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px]" style={{ color: "#5B7A90" }}>
                        &quot;{locatingItem.item.text}&quot; 위치 지정
                      </span>
                      <button
                        onClick={() => {
                          setLocatingItem(null);
                          setPendingPoint(null);
                        }}
                        aria-label="닫기"
                      >
                        <X size={14} color="#94A9B8" />
                      </button>
                    </div>
                    <LocationPicker point={pendingPoint} onPick={setPendingPoint} />
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        onClick={confirmItemLocation}
                        disabled={!pendingPoint}
                        className="text-[12px]"
                        style={{ color: SKY, fontWeight: 700, opacity: pendingPoint ? 1 : 0.5 }}
                      >
                        위치 저장
                      </button>
                      {locatingItem.item.lat != null && (
                        <button
                          onClick={() => clearItemLocation(di, locatingItem.item)}
                          className="text-[12px]"
                          style={{ color: "#EF4444", fontWeight: 700 }}
                        >
                          위치 삭제
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem(di, items)}
                      placeholder="새 항목"
                      className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5"
                      style={{ border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                    />
                    <button onClick={() => addItem(di, items)} aria-label="추가" className="shrink-0">
                      <Plus size={13} color={SKY} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {canEdit && !reorderMode && (
              <div className="flex items-center justify-end gap-3 mt-3">
                <button
                  className="text-[12px] flex items-center gap-1"
                  style={{ color: SKY, fontWeight: 700 }}
                  onClick={() => toggleEditDay(di)}
                >
                  <Pencil size={13} /> {isEditing ? "완료" : "편집"}
                </button>
                <button
                  className="text-[12px] flex items-center gap-1"
                  style={{ color: "#94A9B8", fontWeight: 700 }}
                  onClick={() => deleteDay(di)}
                >
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
