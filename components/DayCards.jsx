"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, Plus, GripVertical, ArrowUpDown, MapPin, StickyNote, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import Spinner from "@/components/Spinner";
import DayItemNotesModal from "@/components/DayItemNotesModal";
import DayDetailModal from "@/components/DayDetailModal";
import IconButton from "@/components/IconButton";
import { SKY, SKY_BORDER } from "@/lib/theme";

const CUSTOM_DAY_BASE = 100000;

// 편집/위치지정 중이 아닌 카드에는 항상 이 고정 참조를 넘겨서, 다른 카드에서 타이핑해도
// (drafts/newText/locatingItem/pendingPoint가 바뀌어도) 이 카드들의 props는 그대로라
// React.memo가 리렌더를 건너뛸 수 있게 합니다.
const EMPTY_DRAFTS = {};
const EMPTY_NOTES = [];

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2 h-[320px] bg-sky-bg border border-sky-border" />,
});

// "1Day" 배지가 이미 순번을 보여주므로, 제목에 남아있는 "1일차"/"1일차:" 같은
// 중복 표기는 화면에서 걷어냅니다(과거에 생성된 지역 데이터에도 그대로 적용됨).
function stripDayLabel(title) {
  return typeof title === "string" ? title.replace(/^\s*\d+\s*일차\s*[:\-]?\s*/, "") : title;
}

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

// 편집 중인 일정 카드 안에서 항목 하나(입력창 행)를 드래그로 옮길 수 있게 하는 행.
// 카드 자체의 드래그 재정렬과 같은 방식(@dnd-kit/sortable, 그립 아이콘에서만 시작)이며,
// 편집 모드일 때만 이 컴포넌트가 쓰이고 그때는 카드 재정렬(reorderMode)이 꺼져 있어서
// 바깥 DndContext(카드 순서용)와 겹치지 않습니다.
function SortableItemRow({ di, item, drafts, setDrafts, onCommitDraft, onOpenLocationPicker, onOpenNotes, onDeleteItem, noteCount }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-1"
    >
      <span
        {...attributes}
        {...listeners}
        className="shrink-0 flex items-center justify-center w-[20px] h-[20px] touch-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <GripVertical size={13} color={isDragging ? SKY : "#94A9B8"} />
      </span>
      <input
        value={drafts[item.key] ?? item.text}
        onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))}
        onBlur={() => onCommitDraft(di, item)}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5 border border-sky-border text-ink"
      />
      <IconButton onClick={() => onOpenLocationPicker(di, item)} ariaLabel="위치 설정">
        <MapPin size={16} color={item.lat != null ? SKY : "#94A9B8"} />
      </IconButton>
      <IconButton onClick={() => onOpenNotes(di, item)} ariaLabel="메모/사진">
        <StickyNote size={16} color={noteCount > 0 ? SKY : "#94A9B8"} />
      </IconButton>
      <IconButton onClick={() => onDeleteItem(di, item)} ariaLabel="항목 삭제">
        <Trash2 size={16} color="#94A9B8" />
      </IconButton>
    </li>
  );
}

// 손가락으로 잡아서 실시간으로 위젯이 따라오고, 카드 사이에 끼워 넣을 수 있는 드래그 재정렬.
// framer-motion의 Reorder는 인접 카드와 하나씩만 순차 스왑하는 방식이라 카드 높이가
// 제각각일 때(항목 개수가 다 다름) 놓은 지점보다 한 칸 더 밀리는 오버슈트가 있었습니다.
// @dnd-kit/sortable은 매 프레임 포인터와 가장 가까운 카드를 다시 계산해서 놓은 지점에
// 정확히 삽입되므로 이걸로 교체했습니다. attributes/listeners를 카드 전체에 붙여서
// 어디를 눌러도 드래그가 시작되게 하고(작은 그립 아이콘은 모바일에서 잡기 어려웠음),
// 탭(상세보기/편집 진입)과는 sensors의 distance 제약(DayCards 컴포넌트 쪽)으로 구분합니다.
//
// memo로 감쌉니다: 일정 카드 수가 늘어날 걸 대비해, 한 카드에서 타이핑/드래그/위치지정을
// 해도 나머지 카드들은 리렌더되지 않게 합니다. 이게 실제로 효과가 있으려면 부모(DayCards)가
// 넘기는 모든 props가 "관련 없는 카드"에는 항상 같은 값(참조)을 유지해야 해서, 부모 쪽도
// 핸들러를 useCallback으로, drafts/newText/locatingItem/pendingPoint는 활성 카드에만
// 실제 값을 주고 나머지에는 고정된 값(EMPTY_DRAFTS/""/null)을 주도록 같이 손봤습니다.
const DayCardItem = memo(function DayCardItem({
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
  onSetCardRef,
  onCommitDraft,
  onDeleteItem,
  onAddItem,
  onOpenLocationPicker,
  onConfirmLocation,
  onClearLocation,
  onCloseLocationPicker,
  onToggleEdit,
  onDeleteDay,
  onOpenNotes,
  onShowDetail,
  onReorderItems,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: di,
    disabled: !reorderMode,
  });
  const isLocatingHere = locatingItem?.dayIdx === di;
  // 항목마다 dayNotes를 매번 filter하면 카드 항목 수만큼 O(n)이 반복되고, 이 카드가
  // 편집 중이라 타이핑 때마다 리렌더될 때도 그대로 다시 도는 게 낭비라 Map으로
  // 한 번만 집계합니다. dayNotes는 편집 중 타이핑으로는 안 바뀌는 값이라(부모의
  // notesByDay가 drafts/newText와 무관하게 메모됨) 이 useMemo는 실제 노트가
  // 추가/삭제될 때만 다시 계산됩니다.
  const noteCounts = useMemo(() => {
    const map = new Map();
    for (const n of dayNotes) map.set(n.item_key, (map.get(n.item_key) || 0) + 1);
    return map;
  }, [dayNotes]);
  const noteCountFor = (key) => noteCounts.get(key) || 0;
  const itemSensors = useSensors(useSensor(PointerSensor));

  // 카드 재정렬(DayCards의 onDragEnd)과 같은 이유로 고정합니다: 이 카드가 활성 편집
  // 카드일 때는 타이핑 한 글자마다 리렌더되는데, 인라인 함수면 그때마다 새 참조가 되어
  // 안쪽 DndContext의 컨텍스트 값이 매번 바뀝니다(items 참조 자체는 편집 중엔 그대로라
  // useCallback으로 묶으면 실제로 안정적입니다).
  const handleItemDragEnd = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((it) => it.key === active.id);
      const newIndex = items.findIndex((it) => it.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onReorderItems(di, items, oldIndex, newIndex);
    },
    [items, di, onReorderItems]
  );

  const transformStyle = transform ? CSS.Transform.toString(transform) : undefined;

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        onSetCardRef(di, el);
      }}
      {...(reorderMode ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        if (dayEditMode) {
          if (!isEditing) onToggleEdit(di);
          return;
        }
        onShowDetail(di);
      }}
      // day-card의 등장 애니메이션(fadeUp)은 fill-mode: both라 끝난 뒤에도 transform:
      // translateY(0)을 계속 붙들고 있습니다. CSS 애니메이션은 같은 인라인 style보다
      // 우선하므로, 애니메이션이 끝난 뒤에도 이 값이 드래그용 transform을 계속 덮어써서
      // 카드가 손가락을 따라 움직이지 않고 놓는 순간에만 훅 튀는 것처럼 보였습니다.
      // 애니메이션이 자연스럽게 끝나는 시점에 꺼서(직접 DOM에만, React style에는 없는
      // 속성이라 리렌더링과 충돌하지 않음) 그 뒤로는 인라인 transform이 정상 적용되게 합니다.
      onAnimationEnd={(e) => {
        if (e.animationName === "fadeUp") e.currentTarget.style.animation = "none";
      }}
      className={`day-card rounded-xl p-4 bg-white relative ${reorderMode ? "touch-none" : ""}`}
      style={{
        animationDelay: `${displayIdx * 0.05}s`,
        border: isDragging ? `1px solid ${SKY}` : `1px solid ${SKY_BORDER}`,
        cursor: reorderMode ? (isDragging ? "grabbing" : "grab") : !isEditing ? "pointer" : undefined,
        transform: isDragging ? `${transformStyle || ""} scale(1.03)`.trim() : transformStyle,
        // 드래그 중인 카드 자신은 트랜지션을 꺼야 손가락 움직임을 프레임마다 그대로 따라옵니다.
        // transition을 계속 걸어두면 매 포인터 이동마다 새 transform이 트랜지션과 경합해
        // 오히려 뚝뚝 끊기며 한 박자 늦게 쫓아오는 것처럼 보입니다. 다른 카드들이 자리를
        // 비켜줄 때 부드럽게 미끄러지는 효과는 그대로 유지됩니다.
        transition: isDragging ? undefined : transition,
        boxShadow: isDragging ? "0px 12px 28px rgba(15,42,61,0.22)" : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-xs shrink-0 mt-0.5 rounded-full h-6 px-2 flex items-center justify-center bg-sky text-white font-bold"
        >
          {displayIdx + 1}Day
        </span>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              value={drafts.__title__ ?? stripDayLabel(title)}
              onChange={(e) => setDrafts((d) => ({ ...d, __title__: e.target.value }))}
              onBlur={() => onCommitDraft(di, { key: "__title__", text: title, sortOrder: 0 })}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              autoFocus
              className="w-full text-[15px] rounded px-1.5 py-0.5 border border-sky-border text-ink font-bold"
            />
          ) : (
            <div className="text-[15px] text-ink font-bold">
              {stripDayLabel(title)}
            </div>
          )}
          {isEditing ? (
            <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
              <SortableContext items={items.map((it) => it.key)} strategy={verticalListSortingStrategy}>
                <ul className="mt-1.5 space-y-1" style={items.length >= 5 ? { maxHeight: 128, overflowY: "auto" } : undefined}>
                  {items.map((it) => (
                    <SortableItemRow
                      key={it.key}
                      di={di}
                      item={it}
                      drafts={drafts}
                      setDrafts={setDrafts}
                      onCommitDraft={onCommitDraft}
                      onOpenLocationPicker={onOpenLocationPicker}
                      onOpenNotes={onOpenNotes}
                      onDeleteItem={onDeleteItem}
                      noteCount={noteCountFor(it.key)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul className="mt-1.5 space-y-1" style={items.length >= 5 ? { maxHeight: 128, overflowY: "auto" } : undefined}>
              {items.map((it) => (
                <li key={it.key} className="flex items-center justify-between gap-1">
                  {it.lat != null ? (
                    <span className="text-[13px] flex items-center gap-1 min-w-0 text-muted">
                      <MapPin size={11} color={SKY} className="shrink-0" /> <span className="truncate">{it.text}</span>
                    </span>
                  ) : (
                    <span className="text-[13px] min-w-0 truncate text-muted">
                      &middot; {it.text}
                    </span>
                  )}
                  {dayEditMode && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNotes(di, it);
                      }}
                      ariaLabel="메모/사진"
                    >
                      <StickyNote size={15} color={noteCountFor(it.key) > 0 ? SKY : "#CBD5E1"} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isEditing && isLocatingHere && (
            <div className="rounded-lg p-2 mt-1.5 bg-slate-bg border border-slate-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-muted">
                  &quot;{locatingItem.item.text}&quot; 위치 지정
                </span>
                <IconButton onClick={onCloseLocationPicker} ariaLabel="닫기">
                  <X size={18} color="#94A9B8" />
                </IconButton>
              </div>
              <LocationPicker point={pendingPoint} onPick={setPendingPoint} />
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={onConfirmLocation}
                  disabled={!pendingPoint}
                  className="text-[12px] text-sky font-bold"
                  style={{ opacity: pendingPoint ? 1 : 0.5 }}
                >
                  위치 저장
                </button>
                {locatingItem.item.lat != null && (
                  <button onClick={() => onClearLocation(di, locatingItem.item)} className="text-[12px] text-danger font-bold">
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
                className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5 border border-sky-border text-ink"
              />
              <IconButton onClick={() => onAddItem(di, items)} ariaLabel="추가">
                <Plus size={16} color={SKY} />
              </IconButton>
            </div>
          )}
        </div>
      </div>

      {dayEditMode && (
        <div className="flex items-center justify-end gap-3 mt-3">
          <button
            className="text-[12px] flex items-center gap-1 text-faint font-bold"
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
});

export default function DayCards({
  days,
  mode,
  regionId,
  regionName,
  onDaysPinsChange,
  canEdit = false,
  onOpenAIEdit,
}) {
  const {
    data: edits,
    setData: setEdits,
    loading,
  } = useRealtimeQuery({
    table: "day_item_edits",
    filterColumn: "region_id",
    filterValue: regionId,
    channelName: `day_items:${regionId}`,
    subscriptionFilter: `region_id=eq.${regionId}`,
  });
  // notes는 삭제 이벤트가 REPLICA IDENTITY 때문에 region_id 필터를 못 받으므로(day_item_edits와
  // 같은 이유) subscriptionFilter 없이 전체 테이블을 구독합니다.
  const { data: notes, setData: setNotes } = useRealtimeQuery({
    table: "day_item_notes",
    filterColumn: "region_id",
    filterValue: regionId,
    order: "created_at",
    channelName: `day_item_notes:${regionId}`,
  });
  const [editingDay, setEditingDay] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newText, setNewText] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dayEditMode, setDayEditMode] = useState(false);
  const [locatingItem, setLocatingItem] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [notingItem, setNotingItem] = useState(null);
  const [detailDay, setDetailDay] = useState(null);
  const cardRefs = useRef({});
  // distance 제약: 카드 전체가 드래그 핸들이라 순서 변경 모드에서도 onClick(상세보기)이
  // 그대로 남아있습니다. 최소 이동 거리 없이는 짧은 탭까지 드래그 시작으로 잡혀 탭이
  // 씹히므로, 8px 이상 움직여야 드래그로 인식하게 해서 탭과 드래그를 구분합니다.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // 타이핑/위치지정 중에도 매번 새로 만들어지는 핸들러(useCallback)가 옛날 값을 들고
  // 있지 않도록, 자주 바뀌는 값들은 여기 ref로도 미러링해서 콜백 안에서 최신값을 읽습니다.
  // 이렇게 하면 커밋/추가/위치확정 핸들러 자체는 참조가 안 바뀌어서(=다른 카드에 영향 없음)
  // 다른 카드들이 이 값들이 바뀔 때마다 같이 리렌더되는 걸 막을 수 있습니다.
  const liveRef = useRef({});
  liveRef.current = { edits, notes, drafts, newText, locatingItem, pendingPoint };

  useEffect(() => {
    if (editingDay !== null) cardRefs.current[editingDay]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editingDay]);

  useEffect(() => {
    setEditingDay(null);
    setDrafts({});
    setNewText("");
    setReorderMode(false);
    setDayEditMode(false);
    setLocatingItem(null);
    setPendingPoint(null);
    setNotingItem(null);
    setDetailDay(null);
  }, [regionId, mode]);

  function editsFor(dayIdx) {
    return edits.filter((e) => e.mode === mode && e.day_index === dayIdx);
  }

  function orderFor(dayIdx) {
    const e = edits.find((ed) => ed.mode === mode && ed.day_index === dayIdx && ed.item_key === "__order__");
    return e ? e.sort_order : dayIdx;
  }

  const upsert = useCallback(
    async (dayIdx, itemKey, patch) => {
      const existing = liveRef.current.edits.find((e) => e.mode === mode && e.day_index === dayIdx && e.item_key === itemKey);
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
    },
    [mode, regionId]
  );

  const commitDraft = useCallback(
    async (dayIdx, item) => {
      const text = (liveRef.current.drafts[item.key] ?? item.text).trim();
      if (text && text !== item.text) {
        // item.lat/lng(현재 화면에 보이는 위치, AI 기본값일 수도 있음)를 같이 넘겨야
        // 이 항목의 첫 수정 기록이 생기면서 위치가 null로 초기화되는 걸 막을 수 있습니다.
        await upsert(dayIdx, item.key, { text, sort_order: item.sortOrder, lat: item.lat, lng: item.lng });
      }
    },
    [upsert]
  );

  const deleteItem = useCallback(
    async (dayIdx, item) => {
      await upsert(dayIdx, item.key, { deleted: true, sort_order: item.sortOrder, text: item.text });
    },
    [upsert]
  );

  const addItem = useCallback(
    async (dayIdx, currentItems) => {
      const text = liveRef.current.newText.trim();
      if (!text) return;
      const maxOrder = currentItems.reduce((m, it) => Math.max(m, it.sortOrder), -1);
      const key = `custom:${crypto.randomUUID()}`;
      setNewText("");
      await upsert(dayIdx, key, { text, sort_order: maxOrder + 1 });
    },
    [upsert]
  );

  const openLocationPicker = useCallback((dayIdx, item) => {
    setLocatingItem((cur) => (cur?.item.key === item.key ? null : { dayIdx, item }));
    setPendingPoint(item.lat != null ? { lat: item.lat, lng: item.lng } : null);
  }, []);

  const closeLocationPicker = useCallback(() => {
    setLocatingItem(null);
    setPendingPoint(null);
  }, []);

  const confirmItemLocation = useCallback(async () => {
    const { locatingItem, pendingPoint } = liveRef.current;
    if (!locatingItem || !pendingPoint) return;
    await upsert(locatingItem.dayIdx, locatingItem.item.key, {
      text: locatingItem.item.text,
      sort_order: locatingItem.item.sortOrder,
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
    });
    closeLocationPicker();
  }, [upsert, closeLocationPicker]);

  const clearItemLocation = useCallback(
    async (dayIdx, item) => {
      await upsert(dayIdx, item.key, { text: item.text, sort_order: item.sortOrder, lat: null, lng: null });
      closeLocationPicker();
    },
    [upsert, closeLocationPicker]
  );

  function notesForItem(dayIdx, itemKey) {
    return notes.filter((n) => n.mode === mode && n.day_index === dayIdx && n.item_key === itemKey);
  }

  const openNotes = useCallback((dayIdx, item) => {
    setNotingItem({ dayIdx, item });
  }, []);

  function closeNotes() {
    setNotingItem(null);
  }

  const showDetail = useCallback((dayIdx) => {
    setDetailDay(dayIdx);
  }, []);

  function closeDetail() {
    setDetailDay(null);
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

  const deleteDay = useCallback(
    async (dayIdx) => {
      if (!canEdit) return;
      if (!window.confirm("이 일정을 삭제할까요?")) return;
      await upsert(dayIdx, "__day__", { deleted: true });
    },
    [canEdit, upsert]
  );

  const toggleEditDay = useCallback(
    (dayIdx) => {
      if (!canEdit) return;
      setEditingDay((cur) => (cur === dayIdx ? null : dayIdx));
      setDrafts({});
      setNewText("");
    },
    [canEdit]
  );

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

  // 카드 DOM을 di별로 저장만 하면 되는 콜백이라 useCallback([])로 고정합니다 — 매번
  // 새로 만들면(예전처럼 .map 안에서 인라인 화살표 함수로 넘기면) 그 자체로 모든 카드의
  // props가 매 렌더마다 바뀐 것처럼 보여서 memo가 무력화됩니다.
  const setCardRef = useCallback((di, el) => {
    cardRefs.current[di] = el;
  }, []);

  function planFor(di) {
    if (di < days.length) {
      const plan = days[di][mode];
      return { title: titleFor(di, plan.title), items: mergeItems(plan.items, editsFor(di)) };
    }
    return { title: titleFor(di, "새 일정"), items: mergeItems([], editsFor(di)) };
  }

  // edits는 실시간 구독으로만 바뀌는 값이라, 여기서 di별로 한 번만 계산해두면
  // drafts/newText 같은 타이핑용 로컬 상태가 바뀌어도(즉 편집 중 매 입력마다) 다시
  // 계산하지 않습니다. notes는 일부러 이 메모의 의존성에서 뺐습니다 — 메모 개수 배지
  // 때문에 notesByDay는 그 자체로 따로 계산하고, 여기 dayPlans/visibleDays(모든
  // 카드의 props이자 메인 지도 핀의 원본)는 노트 하나 추가/삭제될 때마다 전부 새
  // 참조가 되는 일이 없게 합니다. 안 그러면 무관한 노트 변경 때문에 모든 카드가
  // memo를 건너뛰고 리렌더되고, 지도 핀도 내용은 그대론데 매번 다시 그려집니다.
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

  const notesByDay = useMemo(
    () => new Map(visibleDays.map(({ di }) => [di, notes.filter((n) => n.mode === mode && n.day_index === di)])),
    [visibleDays, notes, mode]
  );

  // 메인 지도에는 특정 하루가 아니라 항상 1일차부터 마지막 날까지의 핀을 전부 보여줘야
  // 해서, 카드가 클릭될 때만 계산하던 방식 대신 표시 중인 일정이 바뀔 때마다(추가/삭제/
  // 순서변경/위치지정 포함) 매번 위쪽(Planner)으로 최신 핀 목록을 올려보냅니다.
  useEffect(() => {
    const pins = visibleDays.flatMap(({ di }, displayIdx) => {
      const plan = dayPlans.get(di);
      if (!plan) return [];
      return plan.items
        .filter((it) => it.lat != null && it.lng != null)
        .map((it) => ({ lat: it.lat, lng: it.lng, name: it.text, day: displayIdx + 1 }));
    });
    onDaysPinsChange?.(pins);
  }, [visibleDays, dayPlans, onDaysPinsChange]);

  // .map()은 매번 새 배열을 만들어서, visibleDays 자체가 안 바뀌어도 diOrder는 매
  // 렌더마다 새 참조가 됩니다. 이 배열이 DndContext/SortableContext에 그대로 들어가는데,
  // dnd-kit의 useSortable은 그 컨텍스트를 구독하고 있어서 컨텍스트 값이 바뀌면(참조 비교)
  // React.memo와 무관하게 모든 카드가 다시 렌더링됩니다(memo는 부모→자식 props 경로만
  // 막지, 컨텍스트를 통한 리렌더는 막지 못합니다). visibleDays가 실제로 안 바뀌는 한
  // diOrder도 같은 참조를 유지하게 묶어둡니다.
  const diOrder = useMemo(() => visibleDays.map((v) => v.di), [visibleDays]);

  // DndContext의 onDragEnd에서 arrayMove로 계산한 새 순서(di 배열)를 받아
  // 각 날짜의 sort_order를 그 배열 인덱스로 다시 매겨서 저장합니다.
  const handleReorder = useCallback(
    async (newOrder) => {
      // upsert만 하고 기다리면, 실시간 구독이 DB에 쓴 값을 다시 받아올 때까지(약
      // 0.5~1초) 로컬 edits는 그대로라 카드가 놓은 자리에서 원래 자리로 튕겼다가
      // 나중에 훅 옮겨지는 것처럼 보입니다. 저장과 동시에 로컬 상태도 바로 반영해서
      // 놓은 자리에 즉시 고정되게 하고, 나중에 도착하는 실시간 갱신은 같은 값이라
      // 화면이 다시 바뀌지 않습니다.
      setEdits((prev) => {
        const next = [...prev];
        newOrder.forEach((di, idx) => {
          const i = next.findIndex((e) => e.mode === mode && e.day_index === di && e.item_key === "__order__");
          if (i >= 0) {
            next[i] = { ...next[i], sort_order: idx };
          } else {
            next.push({ region_id: regionId, mode, day_index: di, item_key: "__order__", text: null, deleted: false, sort_order: idx, lat: null, lng: null });
          }
        });
        return next;
      });
      await Promise.all(newOrder.map((di, idx) => upsert(di, "__order__", { sort_order: idx })));
    },
    [mode, regionId, upsert]
  );

  // 카드 재정렬(handleReorder)과 같은 패턴: 낙관적으로 로컬 edits부터 갱신해서 놓은
  // 자리에 바로 고정시키고, 그 다음 각 항목의 sort_order를 실제로 저장합니다. 항목은
  // 기존 수정 기록이 없을 수도 있어서(base 항목을 한 번도 안 고쳤을 때) text/lat/lng를
  // 항상 같이 넘겨야 첫 기록이 생기면서 텍스트나 위치가 비워지는 걸 막을 수 있습니다.
  const reorderItems = useCallback(
    async (dayIdx, currentItems, oldIndex, newIndex) => {
      const newItems = arrayMove(currentItems, oldIndex, newIndex);
      setEdits((prev) => {
        const next = [...prev];
        newItems.forEach((it, idx) => {
          const i = next.findIndex((e) => e.mode === mode && e.day_index === dayIdx && e.item_key === it.key);
          if (i >= 0) {
            next[i] = { ...next[i], sort_order: idx, text: it.text, lat: it.lat, lng: it.lng };
          } else {
            next.push({ region_id: regionId, mode, day_index: dayIdx, item_key: it.key, text: it.text, deleted: false, sort_order: idx, lat: it.lat, lng: it.lng });
          }
        });
        return next;
      });
      await Promise.all(newItems.map((it, idx) => upsert(dayIdx, it.key, { text: it.text, sort_order: idx, lat: it.lat, lng: it.lng })));
    },
    [mode, regionId, upsert]
  );

  // 위와 같은 이유로 onDragEnd 자체도 고정합니다 — 인라인 화살표 함수로 넘기면 매
  // 렌더마다 새 참조라 DndContext의 컨텍스트 값이 매번 바뀝니다.
  const onDragEnd = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id) return;
      const oldIndex = diOrder.indexOf(active.id);
      const newIndex = diOrder.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      handleReorder(arrayMove(diOrder, oldIndex, newIndex));
    },
    [diOrder, handleReorder]
  );

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
          <button className="text-[12px] flex items-center gap-1 text-sky font-bold" onClick={addDay}>
            <Plus size={13} /> 일정
          </button>
          {onOpenAIEdit && (
            <button className="text-[12px] flex items-center gap-1 text-sky font-bold" onClick={onOpenAIEdit}>
              <Sparkles size={13} /> AI
            </button>
          )}
          {visibleDays.length > 1 && (
            <button className="text-[12px] flex items-center gap-1 text-sky font-bold" onClick={toggleReorderMode}>
              <ArrowUpDown size={13} /> {reorderMode ? "완료" : "순서"}
            </button>
          )}
          <button className="text-[12px] flex items-center gap-1 text-sky font-bold" onClick={toggleDayEditMode}>
            <Pencil size={13} /> {dayEditMode ? "완료" : "편집"}
          </button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={diOrder} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {visibleDays.map(({ di }, displayIdx) => {
              const { title, items } = dayPlans.get(di);
              const isEditing = editingDay === di;
              const isLocatingHere = locatingItem?.dayIdx === di;
              return (
                <DayCardItem
                  key={`${regionId}-${mode}-${di}`}
                  di={di}
                  displayIdx={displayIdx}
                  title={title}
                  items={items}
                  isEditing={isEditing}
                  reorderMode={reorderMode}
                  dayEditMode={dayEditMode}
                  dayNotes={notesByDay.get(di) || EMPTY_NOTES}
                  drafts={isEditing ? drafts : EMPTY_DRAFTS}
                  setDrafts={setDrafts}
                  newText={isEditing ? newText : ""}
                  setNewText={setNewText}
                  locatingItem={isLocatingHere ? locatingItem : null}
                  pendingPoint={isLocatingHere ? pendingPoint : null}
                  setPendingPoint={setPendingPoint}
                  onSetCardRef={setCardRef}
                  onCommitDraft={commitDraft}
                  onDeleteItem={deleteItem}
                  onAddItem={addItem}
                  onOpenLocationPicker={openLocationPicker}
                  onConfirmLocation={confirmItemLocation}
                  onClearLocation={clearItemLocation}
                  onCloseLocationPicker={closeLocationPicker}
                  onToggleEdit={toggleEditDay}
                  onDeleteDay={deleteDay}
                  onOpenNotes={openNotes}
                  onShowDetail={showDetail}
                  onReorderItems={reorderItems}
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

      {detailDay !== null && dayPlans.get(detailDay) && (
        <DayDetailModal
          title={dayPlans.get(detailDay).title}
          items={dayPlans.get(detailDay).items}
          notePhotos={(notesByDay.get(detailDay) || [])
            .filter((n) => n.photo_url)
            .map((n) => ({
              url: n.photo_url,
              name: dayPlans.get(detailDay).items.find((it) => it.key === n.item_key)?.text || null,
            }))}
          regionName={regionName}
          onClose={closeDetail}
        />
      )}

    </div>
  );
}
