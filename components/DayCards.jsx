"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, Plus, GripVertical, ArrowUpDown, MapPin, StickyNote, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import DayItemNotesModal from "@/components/DayItemNotesModal";

const SKY = "#0EA5E9";
const CUSTOM_DAY_BASE = 100000;

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 180, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

function mergeItems(baseItems, edits) {
  const editMap = new Map(edits.map((e) => [e.item_key, e]));
  const merged = [];

  // 기존 데이터(data/regions.js, 예전에 생성한 지역)는 항목이 그냥 문자열이고,
  // AI가 새로 생성한 지역은 항목이 {text, lat, lng} 객체라 위치가 같이 붙어 있습니다.
  baseItems.forEach((raw, i) => {
    const key = `base:${i}`;
    const isObj = raw && typeof raw === "object";
    const baseText = isObj ? raw.text : raw;
    const baseLat = isObj ? raw.lat ?? null : null;
    const baseLng = isObj ? raw.lng ?? null : null;
    const e = editMap.get(key);
    if (e?.deleted) return;
    merged.push({
      key,
      text: e ? e.text : baseText,
      sortOrder: e ? e.sort_order : i,
      // e.lat가 null이어도(예: 위치 삭제) "수정 기록이 있다"는 뜻이라 그 값을 그대로 씁니다.
      // 수정 기록 자체가 없을 때만 AI가 심어둔 기본 위치로 대체합니다.
      lat: e ? e.lat : baseLat,
      lng: e ? e.lng : baseLng,
    });
  });

  edits
    .filter((e) => e.item_key.startsWith("custom:") && !e.deleted)
    .forEach((e) => merged.push({ key: e.item_key, text: e.text, sortOrder: e.sort_order, lat: e.lat ?? null, lng: e.lng ?? null }));

  merged.sort((a, b) => a.sortOrder - b.sortOrder);
  return merged;
}

// 손가락으로 잡아서 실시간으로 위젯이 따라오고, 카드 사이에 끼워 넣을 수 있는 드래그 재정렬.
// framer-motion의 Reorder는 인접 카드와 하나씩만 순차 스왑하는 방식이라 카드 높이가
// 제각각일 때(항목 개수가 다 다름) 놓은 지점보다 한 칸 더 밀리는 오버슈트가 있었습니다.
// @dnd-kit/sortable은 매 프레임 포인터와 가장 가까운 카드를 다시 계산해서 놓은 지점에
// 정확히 삽입되므로 이걸로 교체했습니다. 그립 아이콘에서만 드래그가 시작되도록
// attributes/listeners를 그립 엘리먼트에만 붙입니다.
function DayCardItem({
  di,
  displayIdx,
  title,
  items,
  isEditing,
  reorderMode,
  dayEditMode,
  dayNotes,
  drafts,
  setDrafts,
  newText,
  setNewText,
  locatingItem,
  pendingPoint,
  setPendingPoint,
  setCardRef,
  onCommitDraft,
  onDeleteItem,
  onAddItem,
  onOpenLocationPicker,
  onConfirmLocation,
  onClearLocation,
  onCloseLocationPicker,
  onToggleEdit,
  onDeleteDay,
  onLocateItem,
  onOpenNotes,
  onShowRoute,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: di,
    disabled: !reorderMode,
  });
  const isLocatingHere = locatingItem?.dayIdx === di;
  const noteCountFor = (key) => dayNotes.filter((n) => n.item_key === key).length;

  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        setCardRef(el);
      }}
      onClick={() => {
        if (dayEditMode) {
          if (!isEditing) onToggleEdit(di);
          return;
        }
        onShowRoute(
          items.filter((it) => it.lat != null).map((it) => ({ lat: it.lat, lng: it.lng, name: it.text }))
        );
      }}
      className="day-card rounded-xl p-4"
      style={{
        animationDelay: `${displayIdx * 0.05}s`,
        background: "#FFFFFF",
        border: isDragging ? "1px solid #0EA5E9" : "1px solid #BAE6FD",
        cursor: !isEditing ? "pointer" : undefined,
        position: "relative",
        transform: isDragging ? `${transformStyle || ""} scale(1.03)`.trim() : transformStyle,
        transition,
        boxShadow: isDragging ? "0px 12px 28px rgba(15,42,61,0.22)" : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        {reorderMode && (
          <span
            {...attributes}
            {...listeners}
            className="shrink-0 flex items-center justify-center -ml-2 -mt-1"
            style={{ width: 32, height: 32, touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
          >
            <GripVertical size={16} color={isDragging ? SKY : "#94A9B8"} />
          </span>
        )}
        <span
          className="text-xs shrink-0 mt-0.5 rounded-full h-6 px-2 flex items-center justify-center"
          style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
        >
          {displayIdx + 1}Day
        </span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              value={drafts.__title__ ?? title}
              onChange={(e) => setDrafts((d) => ({ ...d, __title__: e.target.value }))}
              onBlur={() => onCommitDraft(di, { key: "__title__", text: title, sortOrder: 0 })}
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
          <ul className="mt-1.5 space-y-1" style={items.length >= 5 ? { maxHeight: 128, overflowY: "auto" } : undefined}>
            {items.map((it) =>
              isEditing ? (
                <li key={it.key} className="flex items-center gap-1">
                  <input
                    value={drafts[it.key] ?? it.text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [it.key]: e.target.value }))}
                    onBlur={() => onCommitDraft(di, it)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5"
                    style={{ border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                  />
                  <button onClick={() => onOpenLocationPicker(di, it)} aria-label="위치 설정" className="shrink-0">
                    <MapPin size={13} color={it.lat != null ? SKY : "#94A9B8"} />
                  </button>
                  <button onClick={() => onOpenNotes(di, it)} aria-label="메모/사진" className="shrink-0">
                    <StickyNote size={13} color={noteCountFor(it.key) > 0 ? SKY : "#94A9B8"} />
                  </button>
                  <button onClick={() => onDeleteItem(di, it)} aria-label="항목 삭제" className="shrink-0">
                    <Trash2 size={13} color="#94A9B8" />
                  </button>
                </li>
              ) : (
                <li key={it.key} className="flex items-center justify-between gap-1">
                  {it.lat != null ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocateItem?.({ lat: it.lat, lng: it.lng, name: it.text });
                      }}
                      className="text-[13px] flex items-center gap-1 text-left min-w-0"
                      style={{ color: "#5B7A90" }}
                    >
                      <MapPin size={11} color={SKY} className="shrink-0" /> <span className="truncate">{it.text}</span>
                    </button>
                  ) : (
                    <span className="text-[13px] min-w-0 truncate" style={{ color: "#5B7A90" }}>
                      &middot; {it.text}
                    </span>
                  )}
                  {dayEditMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNotes(di, it);
                      }}
                      aria-label="메모/사진"
                      className="shrink-0"
                    >
                      <StickyNote size={12} color={noteCountFor(it.key) > 0 ? SKY : "#CBD5E1"} />
                    </button>
                  )}
                </li>
              )
            )}
          </ul>

          {isEditing && isLocatingHere && (
            <div className="rounded-lg p-2 mt-1.5" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px]" style={{ color: "#5B7A90" }}>
                  &quot;{locatingItem.item.text}&quot; 위치 지정
                </span>
                <button onClick={onCloseLocationPicker} aria-label="닫기">
                  <X size={14} color="#94A9B8" />
                </button>
              </div>
              <LocationPicker point={pendingPoint} onPick={setPendingPoint} />
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={onConfirmLocation}
                  disabled={!pendingPoint}
                  className="text-[12px]"
                  style={{ color: SKY, fontWeight: 700, opacity: pendingPoint ? 1 : 0.5 }}
                >
                  위치 저장
                </button>
                {locatingItem.item.lat != null && (
                  <button onClick={() => onClearLocation(di, locatingItem.item)} className="text-[12px]" style={{ color: "#EF4444", fontWeight: 700 }}>
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
                onKeyDown={(e) => e.key === "Enter" && onAddItem(di, items)}
                placeholder="새 항목"
                className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5"
                style={{ border: "1px solid #BAE6FD", color: "#0F2A3D" }}
              />
              <button onClick={() => onAddItem(di, items)} aria-label="추가" className="shrink-0">
                <Plus size={13} color={SKY} />
              </button>
            </div>
          )}
        </div>
      </div>

      {dayEditMode && (
        <div className="flex items-center justify-end mt-3">
          <button
            className="text-[12px] flex items-center gap-1"
            style={{ color: "#94A9B8", fontWeight: 700 }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDay(di);
            }}
          >
            <Trash2 size={13} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}

export default function DayCards({ days, mode, regionId, onLocateItem, onShowRoute, canEdit = false }) {
  const [edits, setEdits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [editingDay, setEditingDay] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newText, setNewText] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dayEditMode, setDayEditMode] = useState(false);
  const [locatingItem, setLocatingItem] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [notingItem, setNotingItem] = useState(null);
  const cardRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (editingDay !== null) cardRefs.current[editingDay]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editingDay]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    async function load() {
      const { data } = await supabase.from("day_item_edits").select("*").eq("region_id", regionId);
      if (alive) {
        setEdits(data || []);
        setLoading(false);
      }
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
    let alive = true;

    async function load() {
      const { data } = await supabase.from("day_item_notes").select("*").eq("region_id", regionId).order("created_at");
      if (alive) setNotes(data || []);
    }
    load();

    // filter 없이 구독합니다: DELETE 이벤트는 기본 REPLICA IDENTITY에서 기본키(id)만
    // 실려오고 region_id는 빠져서, region_id 필터를 걸면 삭제 이벤트 자체가 조용히
    // 무시됩니다(추가/수정은 새 행 전체가 오니 문제 없지만 삭제만 이 문제가 있음).
    // load()가 어차피 region_id로 다시 걸러서 가져오므로 필터 없이도 결과는 정확합니다.
    const channel = supabase
      .channel(`day_item_notes:${regionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_item_notes" }, load)
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
    setDayEditMode(false);
    setLocatingItem(null);
    setPendingPoint(null);
    setNotingItem(null);
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
      // item.lat/lng(현재 화면에 보이는 위치, AI 기본값일 수도 있음)를 같이 넘겨야
      // 이 항목의 첫 수정 기록이 생기면서 위치가 null로 초기화되는 걸 막을 수 있습니다.
      await upsert(dayIdx, item.key, { text, sort_order: item.sortOrder, lat: item.lat, lng: item.lng });
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

  function closeLocationPicker() {
    setLocatingItem(null);
    setPendingPoint(null);
  }

  async function confirmItemLocation() {
    if (!locatingItem || !pendingPoint) return;
    await upsert(locatingItem.dayIdx, locatingItem.item.key, {
      text: locatingItem.item.text,
      sort_order: locatingItem.item.sortOrder,
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
    });
    closeLocationPicker();
  }

  async function clearItemLocation(dayIdx, item) {
    await upsert(dayIdx, item.key, { text: item.text, sort_order: item.sortOrder, lat: null, lng: null });
    closeLocationPicker();
  }

  function notesForDay(dayIdx) {
    return notes.filter((n) => n.mode === mode && n.day_index === dayIdx);
  }

  function notesForItem(dayIdx, itemKey) {
    return notesForDay(dayIdx).filter((n) => n.item_key === itemKey);
  }

  function openNotes(dayIdx, item) {
    setNotingItem({ dayIdx, item });
  }

  function closeNotes() {
    setNotingItem(null);
  }

  async function addNote(dayIdx, item, text, file) {
    let photo_url = null;
    if (file) {
      const path = `${regionId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("day-item-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("day-item-photos").getPublicUrl(path);
      photo_url = pub.publicUrl;
    }
    const { error } = await supabase.from("day_item_notes").insert({
      region_id: regionId,
      mode,
      day_index: dayIdx,
      item_key: item.key,
      text: text || null,
      photo_url,
    });
    if (error) throw error;
  }

  async function deleteNote(id) {
    // RLS가 막으면 에러 없이 0건 삭제로 조용히 끝날 수 있어서, select()로 실제 삭제된
    // 행을 확인합니다(deleteRegion/deleteTrip과 같은 패턴).
    const { data, error } = await supabase.from("day_item_notes").delete().eq("id", id).select();
    if (error) {
      alert("삭제에 실패했어요: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("삭제 권한이 없어요.");
    }
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
    setDayEditMode(false);
  }

  // 카드마다 따로 있던 "편집" 버튼을 여기 하나로 모읍니다. 켜져 있는 동안은 카드를
  // 클릭하면 그 카드가 바로 편집 모드로 열립니다(삭제는 카드 안의 삭제 버튼으로).
  function toggleDayEditMode() {
    if (!canEdit) return;
    setDayEditMode((v) => !v);
    setEditingDay(null);
    setDrafts({});
    setNewText("");
    setReorderMode(false);
  }

  function planFor(di) {
    if (di < days.length) {
      const plan = days[di][mode];
      return { title: titleFor(di, plan.title), items: mergeItems(plan.items, editsFor(di)) };
    }
    return { title: titleFor(di, "새 일정"), items: mergeItems([], editsFor(di)) };
  }

  // edits는 실시간 구독으로만 바뀌는 값이라, 여기서 di별로 한 번만 계산해두면
  // drafts/newText 같은 타이핑용 로컬 상태가 바뀌어도(즉 편집 중 매 입력마다) 다시 계산하지 않습니다.
  const { customDayIndices, visibleDays, dayPlans } = useMemo(() => {
    const customDayIndices = [...new Set(edits.filter((e) => e.item_key === "__custom_day__").map((e) => e.day_index))];
    const allDayIndices = days.map((_, i) => i).concat(customDayIndices);

    const visibleDays = allDayIndices
      .map((di) => ({ di, order: orderFor(di) }))
      .filter((v) => !isDayDeleted(v.di))
      .sort((a, b) => a.order - b.order);

    const dayPlans = new Map(visibleDays.map(({ di }) => [di, planFor(di)]));

    return { customDayIndices, visibleDays, dayPlans };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, days, mode]);

  const diOrder = visibleDays.map((v) => v.di);

  // DndContext의 onDragEnd에서 arrayMove로 계산한 새 순서(di 배열)를 받아
  // 각 날짜의 sort_order를 그 배열 인덱스로 다시 매겨서 저장합니다.
  async function handleReorder(newOrder) {
    await Promise.all(newOrder.map((di, idx) => upsert(di, "__order__", { sort_order: idx })));
  }

  async function addDay() {
    if (!canEdit) return;
    const nextIdx = customDayIndices.length ? Math.max(...customDayIndices) + 1 : CUSTOM_DAY_BASE;
    const maxOrder = visibleDays.reduce((m, v) => Math.max(m, v.order), -1);
    await upsert(nextIdx, "__custom_day__", {});
    await upsert(nextIdx, "__title__", { text: "새 일정" });
    await upsert(nextIdx, "__order__", { sort_order: maxOrder + 1 });
    setDayEditMode(true);
    setEditingDay(nextIdx);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex items-center justify-end gap-3 -mb-1">
          <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={addDay}>
            <Plus size={13} /> 일정
          </button>
          {visibleDays.length > 1 && (
            <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={toggleReorderMode}>
              <ArrowUpDown size={13} /> {reorderMode ? "완료" : "순서"}
            </button>
          )}
          <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={toggleDayEditMode}>
            <Pencil size={13} /> {dayEditMode ? "완료" : "편집"}
          </button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const oldIndex = diOrder.indexOf(active.id);
          const newIndex = diOrder.indexOf(over.id);
          if (oldIndex === -1 || newIndex === -1) return;
          handleReorder(arrayMove(diOrder, oldIndex, newIndex));
        }}
      >
        <SortableContext items={diOrder} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {visibleDays.map(({ di }, displayIdx) => {
              const { title, items } = dayPlans.get(di);
              return (
                <DayCardItem
                  key={`${regionId}-${mode}-${di}`}
                  di={di}
                  displayIdx={displayIdx}
                  title={title}
                  items={items}
                  isEditing={editingDay === di}
                  reorderMode={reorderMode}
                  dayEditMode={dayEditMode}
                  dayNotes={notesForDay(di)}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  newText={newText}
                  setNewText={setNewText}
                  locatingItem={locatingItem}
                  pendingPoint={pendingPoint}
                  setPendingPoint={setPendingPoint}
                  setCardRef={(el) => (cardRefs.current[di] = el)}
                  onCommitDraft={commitDraft}
                  onDeleteItem={deleteItem}
                  onAddItem={addItem}
                  onOpenLocationPicker={openLocationPicker}
                  onConfirmLocation={confirmItemLocation}
                  onClearLocation={clearItemLocation}
                  onCloseLocationPicker={closeLocationPicker}
                  onToggleEdit={toggleEditDay}
                  onDeleteDay={deleteDay}
                  onLocateItem={onLocateItem}
                  onShowRoute={onShowRoute}
                  onOpenNotes={openNotes}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {notingItem && (
        <DayItemNotesModal
          itemText={notingItem.item.text}
          notes={notesForItem(notingItem.dayIdx, notingItem.item.key)}
          canEdit={canEdit}
          onAdd={(text, file) => addNote(notingItem.dayIdx, notingItem.item, text, file)}
          onDelete={deleteNote}
          onClose={closeNotes}
        />
      )}
    </div>
  );
}
