"use client";

import { useState } from "react";
import { FileText, Plus, ChevronLeft, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import IconButton from "@/components/IconButton";
import { SKY, DANGER } from "@/lib/theme";

// memo는 DB에 여전히 문자열 하나로 저장되지만(스키마 변경 없이), 화면에서는 항목
// 목록으로 보여주고 편집합니다. 항목 하나가 여러 줄일 수 있어서(입력창에서 엔터로
// 줄바꿈), 항목 사이 구분자와 항목 내부 줄바꿈이 섞이지 않도록 JSON 배열 문자열로
// 저장합니다. 이 형식이 되기 전(자유 텍스트 또는 줄바꿈 하나로 구분하던 목록)의 기존
// 메모와도 호환되도록, JSON으로 못 읽으면 줄바꿈 기준으로 나눠서 보여줍니다.
function parseMemoItems(memo) {
  if (!memo) return [];
  try {
    const parsed = JSON.parse(memo);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string" && s.trim() !== "");
  } catch {}
  return memo.split("\n").map((s) => s.trim()).filter(Boolean);
}

// "https://att-japan.net/ko/ibaraki/" 처럼 명확한 http(s) URL만 링크로 바꿉니다.
// 애매한 형태(프로토콜 없는 "example.com" 등)는 일부러 무시합니다.
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function linkifyMemo(text) {
  return text.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-sky">
        {part}
      </a>
    ) : (
      part
    )
  );
}

// 특정 일정 항목이 아니라 지역 전체에 자유롭게 남기는 메모장(준비물, 체크리스트 등).
// 목록에서는 항목마다 한 줄만 보이고, 항목을 누르면 그 메모의 전체 내용만 노트
// 페이지처럼 펼쳐서 보여줍니다(목록 전체가 같이 늘어나는 아코디언 방식이 아님).
export default function MemoModal({ memo, onSave, onClose }) {
  const [items, setItems] = useState(() => parseMemoItems(memo));
  const [draft, setDraft] = useState("");
  // "list" | "add" | "detail" 세 화면 중 하나만 보입니다.
  const [screen, setScreen] = useState("list");
  const [detailIndex, setDetailIndex] = useState(null);

  function persist(nextItems) {
    setItems(nextItems);
    onSave(JSON.stringify(nextItems));
  }

  function saveNewItem() {
    const text = draft.trim();
    if (!text) return;
    persist([...items, text]);
    setDraft("");
    setScreen("list");
  }

  function deleteItem(i) {
    persist(items.filter((_, idx) => idx !== i));
    setScreen("list");
    setDetailIndex(null);
  }

  function openDetail(i) {
    setDetailIndex(i);
    setScreen("detail");
  }

  function toggleAdd() {
    setScreen((s) => (s === "add" ? "list" : "add"));
  }

  return (
    <Modal
      icon={FileText}
      title="메모장"
      onClose={onClose}
      minHeight={"50vh"}
      headerExtra={
        screen !== "detail" && (
          <button onClick={toggleAdd} aria-label="메모 추가" className="shrink-0">
            <Plus size={18} color={screen === "add" ? SKY : "#5B7A90"} />
          </button>
        )
      }
    >
      {screen === "add" ? (
        <div className="flex flex-col gap-2 h-full">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="새 메모를 적어보세요 — 엔터로 줄바꿈"
            autoFocus
            className="w-full flex-1 text-[14px] rounded-lg p-3 border border-sky-border text-ink resize-none outline-none focus:border-sky focus:ring-1 focus:ring-sky"
          />
          <div className="flex justify-end">
            <button onClick={saveNewItem} className="text-[12px] rounded-lg px-3 py-1.5 bg-sky text-white font-bold">
              저장
            </button>
          </div>
        </div>
      ) : screen === "detail" ? (
        <div className="flex flex-col gap-3 h-full">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen("list")} className="flex items-center gap-1 text-[12px] text-muted font-bold">
              <ChevronLeft size={15} /> 목록으로
            </button>
            <IconButton onClick={() => deleteItem(detailIndex)} ariaLabel="메모 삭제">
              <Trash2 size={15} color={DANGER} />
            </IconButton>
          </div>
          <div className="no-auto-phrase whitespace-pre-wrap text-[14px] text-ink rounded-lg p-3 border border-slate-border flex-1 overflow-y-auto">
            {linkifyMemo(items[detailIndex] ?? "")}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 h-full overflow-y-auto">
          {items.map((text, i) => (
            <li
              key={i}
              onClick={() => openDetail(i)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] bg-slate-bg border border-slate-border text-ink cursor-pointer"
            >
              <span
                className="no-auto-phrase flex-1 min-w-0"
                style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {linkifyMemo(text)}
              </span>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  deleteItem(i);
                }}
                ariaLabel="메모 삭제"
              >
                <Trash2 size={13} color="#94A9B8" />
              </IconButton>
            </li>
          ))}
          {items.length === 0 && <li className="text-[12px] text-center py-2 text-faint">아직 메모가 없어요</li>}
        </ul>
      )}
    </Modal>
  );
}
