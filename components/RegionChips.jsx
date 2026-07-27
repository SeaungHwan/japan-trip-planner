"use client";

import { memo } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { getIcon } from "@/data/icons";

const SKY = "#0EA5E9";

// 칩 줄은 가로로만 스크롤/재정렬되는 목록이라, 세로로 손가락이 흔들리는 것까지 그대로
// 따라가면 칩이 줄 밖으로 떠서 내려가는 것처럼 보입니다. y를 0으로 고정해 드래그가
// 가로 방향으로만 움직이게 합니다.
function restrictToHorizontalAxis({ transform }) {
  return { ...transform, y: 0 };
}

// index/onSelect(안정된 참조)를 그대로 받아 클릭 핸들러를 내부에서 만듭니다.
// 그래야 부모가 렌더링될 때마다 새 함수를 넘겨서 memo가 무력화되는 걸 막을 수 있습니다.
// 폭을 이름 길이에 맡기지 않고 고정해서, 화면에 한 번에 3~4개만 보이고 나머지는
// 옆으로 스크롤해야 보이게 합니다.
//
// 별도의 "순서 바꾸기" 모드 버튼 없이, 칩을 꾹 누르고 있으면 바로 드래그로 순서를
// 바꿀 수 있습니다(useSensor의 activationConstraint delay). 짧게 누르면(탭) 그냥
// onSelect가 호출되고, 가로로 스와이프하면 원래대로 칩 줄이 스크롤됩니다 — delay가
// 지나기 전에 손가락이 tolerance 이상 움직이면 드래그 자체가 취소되기 때문입니다.
// 그래서 이 버튼에는 touch-action을 막지 않습니다(막으면 가로 스크롤이 안 됨).
const Chip = memo(function Chip({ r, isActive, index, onSelect, canReorder }) {
  const Icon = getIcon(r.icon);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: r.id,
    disabled: !canReorder,
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="chip-btn shrink-0 flex items-center justify-center gap-1.5 rounded-full px-2 text-sm"
      style={{
        width: 96,
        height: 40,
        background: isActive ? SKY : "#F0F9FF",
        color: isActive ? "#FFFFFF" : "#0F2A3D",
        border: `1px solid ${isActive ? SKY : "#BAE6FD"}`,
        fontWeight: isActive ? 700 : 500,
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
      onClick={() => onSelect(index)}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{r.kr}</span>
    </button>
  );
});

export default function RegionChips({
  regions,
  active,
  onSelect,
  showMore,
  onToggleMore,
  moreCount,
  baseCount,
  canAddRegion,
  onAddRegion,
  canReorder,
  onReorder,
}) {
  const base = regions.slice(0, baseCount);
  const extra = regions.slice(baseCount);
  // PointerSensor 하나로는 안드로이드(삼성 기본 브라우저/크롬)에서 delay가 끝나기 전에
  // 브라우저 자체의 네이티브 가로 스크롤 제스처가 먼저 손 제스처를 가져가 버려서 드래그가
  // 아예 시작되지 않는 문제가 있었습니다(데스크톱 마우스에서는 재현되지 않아 놓치기 쉬움).
  // TouchSensor는 preventDefault를 걸 수 있는 non-passive 터치 리스너로 delay/tolerance를
  // 직접 판정해서, 같은 "꾹 누르면 드래그·짧게 스와이프하면 스크롤" 동작을 터치에서도
  // 안정적으로 재현합니다. 마우스/터치가 같은 포인터 이벤트로 겹쳐 잡히지 않도록
  // PointerSensor 대신 MouseSensor+TouchSensor 조합을 씁니다.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } })
  );

  function handleDragEnd({ active: activeChip, over }) {
    if (!over || activeChip.id === over.id) return;
    const ids = base.map((r) => r.id);
    const oldIndex = ids.indexOf(activeChip.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(oldIndex, newIndex);
  }

  return (
    <>
      {/* 명소 4~5개부터는 칩 줄이 넘쳐서, 이전처럼 "+ 추가" 버튼을 같은 가로 스크롤
          영역 안에 sticky로 두면(overflow-x-auto인 flex 컨테이너 안의 sticky는 브라우저마다
          붕 뜨거나 칩에 가려지는 문제가 있었습니다) 버튼이 칩에 가려 뚫고 지나가 버렸습니다.
          칩 목록만 자체 스크롤 영역으로 따로 빼고, 추가 버튼은 그 바깥의 고정 형제
          엘리먼트로 둬서 항상 스크롤 영역 오른쪽에 그대로 보이게 합니다. */}
      <div className="flex items-center gap-2 mb-2 mt-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis]}
        >
          <SortableContext items={base.map((r) => r.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 flex-1 min-w-0 chip-row">
              {base.map((r, i) => (
                <Chip key={r.id} r={r} isActive={i === active} index={i} onSelect={onSelect} canReorder={canReorder} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {canAddRegion && (
          <button
            className="shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 30, height: 30, background: "#FFFFFF", color: SKY, border: "1px dashed #BAE6FD" }}
            onClick={onAddRegion}
            aria-label="새 지역 추가"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {(moreCount > 0 || extra.length > 0) && (
        <div className="mb-5">
          {moreCount > 0 && (
            <button
              className="text-xs mb-2 flex items-center gap-1"
              style={{ color: SKY, fontWeight: 700 }}
              onClick={onToggleMore}
            >
              {showMore ? (
                <>
                  <ChevronUp size={14} /> 접기
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> 여행지 더보기 (+{moreCount})
                </>
              )}
            </button>
          )}
          {extra.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extra.map((r, j) => (
                <Chip
                  key={r.id}
                  r={r}
                  isActive={baseCount + j === active}
                  index={baseCount + j}
                  onSelect={onSelect}
                  canReorder={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
