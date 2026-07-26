"use client";

import { useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import Modal from "@/components/Modal";

const SKY = "#0EA5E9";

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
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: SKY }}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

// 특정 일정 항목이 아니라 지역 전체에 자유롭게 남기는 메모장(준비물, 체크리스트 등).
// 명소/음식 패널과 같은 목록 형태라 추가/삭제할 때마다 바로 저장됩니다.
export default function MemoModal({ memo, onSave, onClose }) {
  const [items, setItems] = useState(() => parseMemoItems(memo));
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpand(i) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function persist(nextItems) {
    setItems(nextItems);
    onSave(JSON.stringify(nextItems));
  }

  function saveNewItem() {
    const text = draft.trim();
    if (!text) return;
    persist([...items, text]);
    setDraft("");
    setAdding(false);
  }

  function deleteItem(i) {
    persist(items.filter((_, idx) => idx !== i));
  }

  return (
    <Modal
      icon={FileText}
      title="메모장"
      onClose={onClose}
      minHeight={300}
      headerExtra={
        <button onClick={() => setAdding((v) => !v)} aria-label="메모 추가" className="shrink-0">
          <Plus size={18} color={adding ? SKY : "#5B7A90"} />
        </button>
      }
    >
      {adding ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="새 메모 (준비물, 체크리스트 등) — 엔터로 줄바꿈"
            rows={6}
            autoFocus
            className="w-full text-[13px] rounded-lg p-2.5"
            style={{ border: "1px solid #BAE6FD", color: "#0F2A3D", resize: "vertical" }}
          />
          <div className="flex justify-end">
            <button
              onClick={saveNewItem}
              className="text-[12px] rounded-lg px-3 py-1.5"
              style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" style={{ maxHeight: 400, overflowY: "auto" }}>
          {items.map((text, i) => {
            const isExpanded = expanded.has(i);
            return (
              <li
                key={i}
                onClick={() => toggleExpand(i)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#0F2A3D", cursor: "pointer" }}
              >
                <span
                  className="no-auto-phrase flex-1 min-w-0"
                  style={
                    isExpanded
                      ? { whiteSpace: "pre-wrap" }
                      : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                  }
                >
                  {linkifyMemo(text)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(i);
                  }}
                  aria-label="메모 삭제"
                  className="shrink-0"
                >
                  <X size={13} color="#94A9B8" />
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-[12px] text-center py-2" style={{ color: "#94A9B8" }}>
              아직 메모가 없어요
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}
