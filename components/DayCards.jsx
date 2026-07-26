"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, Plus, GripVertical, ArrowUpDown, MapPin, StickyNote, FileText, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import DayItemNotesModal from "@/components/DayItemNotesModal";
import ImageSwiper from "@/components/ImageSwiper";
import Modal from "@/components/Modal";

const SKY = "#0EA5E9";
const CUSTOM_DAY_BASE = 100000;

// 편집/위치지정 중이 아닌 카드에는 항상 이 고정 참조를 넘겨서, 다른 카드에서 타이핑해도
// (drafts/newText/locatingItem/pendingPoint가 바뀌어도) 이 카드들의 props는 그대로라
// React.memo가 리렌더를 건너뛸 수 있게 합니다.
const EMPTY_DRAFTS = {};
const EMPTY_NOTES = [];

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 180, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

const DayDetailMap = dynamic(() => import("@/components/DayDetailMap"), {
  ssr: false,
  loading: () => <div className="rounded-lg mb-3" style={{ height: 160, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
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

// 일정 항목별 사진은 그 날 팝업을 열 때마다 새로 조회하기엔 아까워서(위키피디아 검색
// 여러 건 + 병렬 요청) 세션 동안은 같은 지역+항목 조합을 다시 열면 재요청하지 않도록
// 캐싱합니다(WeatherBadge와 같은 패턴, 탭을 새로고침하면 비워짐).
const dayPhotosCache = new Map();

// 일정 카드의 "자세히보기"에서 여는 팝업: 그 날 항목에 맞는 실제 사진(위키피디아에서
// 항목별로 찾음) + 실제로 남긴 메모 사진을 스와이퍼로(둘 다 없으면 아예 안 보임 —
// 지역 전체의 대표 이미지는 모든 날짜에 똑같이 나와서 "그 일정 데이터"라고 보기
// 어려워 여기엔 쓰지 않습니다), 그리고 그 날 항목들을 카드보다 자세히(팝업 안에서만
// 움직이는 자체 지도 포함) 보여줍니다. "지도에서 보기"는 메인 지도를 건드리지 않고
// 이 팝업 안의 지도만 그 지점으로 이동시킵니다.
function DayDetailModal({ title, items, notePhotos, regionName, onClose }) {
  const [focusPoint, setFocusPoint] = useState(null);
  const [itemPhotos, setItemPhotos] = useState([]);
  const mapPoints = items
    .map((it, i) => ({ lat: it.lat, lng: it.lng, name: it.text, num: i + 1 }))
    .filter((p) => p.lat != null);

  const itemTexts = items.map((it) => it.text);
  const cacheKey = `${regionName}|${itemTexts.join("|")}`;

  useEffect(() => {
    let alive = true;
    setItemPhotos([]);

    const cached = dayPhotosCache.get(cacheKey);
    const request =
      cached ||
      fetch("/api/day-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionName, items: itemTexts }),
      })
        .then((res) => res.json())
        .then((data) => (Array.isArray(data.photos) ? data.photos : []))
        .catch(() => []);
    if (!cached) dayPhotosCache.set(cacheKey, request);

    request.then((photos) => {
      if (alive) setItemPhotos(photos.filter(Boolean));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const images = [...notePhotos, ...itemPhotos];

  return (
    <Modal title={title} onClose={onClose}>
      {mapPoints.length > 0 && <DayDetailMap points={mapPoints} focus={focusPoint} />}
      {images.length > 0 && (
        <div className="mb-3">
          <ImageSwiper images={images} />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <span
              className="shrink-0 rounded-full flex items-center justify-center text-[11px]"
              style={{ width: 20, height: 20, background: SKY, color: "#FFFFFF", fontWeight: 700 }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px]" style={{ color: "#0F2A3D" }}>
                {it.text}
              </p>
              {it.lat != null && (
                <button
                  onClick={() => setFocusPoint({ lat: it.lat, lng: it.lng })}
                  className="text-[11px] flex items-center gap-1 mt-0.5"
                  style={{ color: SKY, fontWeight: 700 }}
                >
                  <MapPin size={11} /> 지도에서 보기
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// 특정 일정 항목이 아니라 지역 전체에 자유롭게 남기는 메모장(준비물, 체크리스트 등).
// 저장 전까지는 로컬 draft로만 들고 있다가 "저장"을 눌러야 실제로 반영됩니다.
function MemoModal({ memo, onSave, onClose }) {
  const [draft, setDraft] = useState(memo || "");

  return (
    <Modal icon={FileText} title="메모장" onClose={onClose}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="자유롭게 메모를 남겨보세요 (준비물, 체크리스트 등)"
        rows={8}
        className="w-full text-[13px] rounded-lg p-2.5"
        style={{ border: "1px solid #BAE6FD", color: "#0F2A3D", resize: "vertical" }}
      />
      <button
        onClick={() => {
          onSave(draft);
          onClose();
        }}
        className="w-full mt-2 rounded-lg py-2 text-[13px]"
        style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
      >
        저장
      </button>
    </Modal>
  );
}

// 손가락으로 잡아서 실시간으로 위젯이 따라오고, 카드 사이에 끼워 넣을 수 있는 드래그 재정렬.
// framer-motion의 Reorder는 인접 카드와 하나씩만 순차 스왑하는 방식이라 카드 높이가
// 제각각일 때(항목 개수가 다 다름) 놓은 지점보다 한 칸 더 밀리는 오버슈트가 있었습니다.
// @dnd-kit/sortable은 매 프레임 포인터와 가장 가까운 카드를 다시 계산해서 놓은 지점에
// 정확히 삽입되므로 이걸로 교체했습니다. 그립 아이콘에서만 드래그가 시작되도록
// attributes/listeners를 그립 엘리먼트에만 붙입니다.
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
        onSetCardRef(di, el);
      }}
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
      className="day-card rounded-xl p-4"
      style={{
        animationDelay: `${displayIdx * 0.05}s`,
        background: "#FFFFFF",
        border: isDragging ? "1px solid #0EA5E9" : "1px solid #BAE6FD",
        cursor: !isEditing ? "pointer" : undefined,
        position: "relative",
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
              value={drafts.__title__ ?? stripDayLabel(title)}
              onChange={(e) => setDrafts((d) => ({ ...d, __title__: e.target.value }))}
              onBlur={() => onCommitDraft(di, { key: "__title__", text: title, sortOrder: 0 })}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              autoFocus
              className="w-full text-[15px] rounded px-1.5 py-0.5"
              style={{ border: "1px solid #BAE6FD", color: "#0F2A3D", fontWeight: 700 }}
            />
          ) : (
            <div className="text-[15px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
              {stripDayLabel(title)}
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
                    <span className="text-[13px] flex items-center gap-1 min-w-0" style={{ color: "#5B7A90" }}>
                      <MapPin size={11} color={SKY} className="shrink-0" /> <span className="truncate">{it.text}</span>
                    </span>
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
        <div className="flex items-center justify-end gap-3 mt-3">
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
});

export default function DayCards({ days, mode, regionId, regionName, memo, onSaveMemo, onDaysPinsChange, canEdit = false }) {
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
  const [detailDay, setDetailDay] = useState(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const cardRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor));

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
    setDetailDay(null);
    setMemoOpen(false);
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
          <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={addDay}>
            <Plus size={13} /> 일정
          </button>
          {visibleDays.length > 1 && (
            <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={toggleReorderMode}>
              <ArrowUpDown size={13} /> {reorderMode ? "완료" : "순서"}
            </button>
          )}
          <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={() => setMemoOpen(true)}>
            <FileText size={13} /> 메모장
          </button>
          <button className="text-[12px] flex items-center gap-1" style={{ color: SKY, fontWeight: 700 }} onClick={toggleDayEditMode}>
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

      {memoOpen && <MemoModal memo={memo} onSave={onSaveMemo} onClose={() => setMemoOpen(false)} />}
    </div>
  );
}
