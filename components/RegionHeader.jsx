"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, CalendarDays, Wallet, Plus, X } from "lucide-react";
import { getIcon } from "@/data/icons";
import Feedback from "@/components/Feedback";

const SKY = "#0EA5E9";

function formatDate(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`;
}

function formatRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate) return formatDate(startDate);
  return `${formatDate(startDate)}—${formatDate(endDate)}`;
}

// 총무 기능: 항공권/숙박/렌트카 등 항목 이름과 금액을 자유롭게 추가/삭제합니다.
// 카테고리를 고정하지 않아서(등등) foods처럼 이름 기반 리스트에 금액만 얹은 형태입니다.
function BudgetModal({ budget, canEdit, onAdd, onDelete, onClose }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const total = (budget || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  function submitAdd() {
    if (!name.trim()) return;
    onAdd(name, Number(amount) || 0);
    setName("");
    setAmount("");
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,42,61,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl max-h-[85vh] flex flex-col overflow-hidden"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[15px] flex items-center gap-1.5" style={{ color: "#0F2A3D", fontWeight: 700 }}>
              <Wallet size={16} color={SKY} /> 총무
            </span>
            <button onClick={onClose} aria-label="닫기">
              <X size={18} color="#5B7A90" />
            </button>
          </div>

          <ul className="flex flex-col gap-1.5 mb-3">
            {(budget || []).map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <span className="text-[13px] truncate" style={{ color: "#0F2A3D" }}>
                  {b.name}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px]" style={{ color: "#5B7A90", fontWeight: 700 }}>
                    {(Number(b.amount) || 0).toLocaleString()}원
                  </span>
                  {canEdit && (
                    <button onClick={() => onDelete(i)} aria-label="항목 삭제">
                      <X size={12} color="#94A9B8" />
                    </button>
                  )}
                </span>
              </li>
            ))}
            {(budget || []).length === 0 && (
              <li className="text-[12px]" style={{ color: "#94A9B8" }}>
                아직 등록된 비용이 없어요
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between px-1 mb-3">
            <span className="text-[12px]" style={{ color: "#5B7A90" }}>
              합계
            </span>
            <span className="text-[14px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
              {total.toLocaleString()}원
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                placeholder="항목 (예: 항공권)"
                className="flex-1 min-w-0 text-[12px] rounded px-2 py-1.5"
                style={{ border: "1px solid #BAE6FD" }}
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                type="number"
                placeholder="금액"
                className="w-20 shrink-0 text-[12px] rounded px-2 py-1.5"
                style={{ border: "1px solid #BAE6FD" }}
              />
              <button onClick={submitAdd} aria-label="추가" className="shrink-0">
                <Plus size={16} color={SKY} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function RegionHeader({ region, onDelete, canEdit, onSaveDates, onAddBudgetItem, onDeleteBudgetItem }) {
  const Icon = getIcon(region.icon);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function openDateModal() {
    setStartDate(region.startDate || "");
    setEndDate(region.endDate || "");
    setDateModalOpen(true);
  }

  function submitDates() {
    onSaveDates(startDate || null, endDate || null);
    setDateModalOpen(false);
  }

  return (
    <div className="mb-3 anim-fadeup" key={region.id}>
      <div className="flex items-center gap-2">
        <Icon size={18} color={SKY} />
        <span className="text-lg serif" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          {region.kr}
        </span>
        <span className="text-xs" style={{ color: "#94A9B8" }}>
          {region.jp}
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {canEdit && (
            <button onClick={() => setBudgetModalOpen(true)} aria-label="총무" className="flex items-center gap-1">
              <Wallet size={14} color="#94A9B8" />
            </button>
          )}
          {canEdit && (
            <button onClick={openDateModal} aria-label="지역 날짜 수정" className="flex items-center gap-1">
              <CalendarDays size={14} color="#94A9B8" />
              <span className="text-[11px]" style={{ color: "#94A9B8" }}>
                {region.startDate ? formatRange(region.startDate, region.endDate) : "날짜"}
              </span>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} aria-label="지역 삭제" className="shrink-0">
              <Trash2 size={15} color="#94A9B8" />
            </button>
          )}
        </div>
      </div>
      {region.note && (
        <p className="text-[13px] mt-1" style={{ color: "#5B7A90" }}>
          {region.note}
        </p>
      )}
      <Feedback targetKey={`region:${region.id}`} />

      {dateModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,42,61,0.5)" }}
          >
            <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "#FFFFFF" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
                  {region.kr} 날짜
                </span>
                <button onClick={() => setDateModalOpen(false)}>
                  <X size={18} color="#5B7A90" />
                </button>
              </div>
              <p className="text-[12px] mb-2" style={{ color: "#94A9B8" }}>
                비워두면 여행 전체 날짜를 그대로 씁니다. 이 지역만 일정이 다르면 여기서 따로 지정하세요.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 min-w-0 text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <span className="text-sm" style={{ color: "#94A9B8" }}>
                  —
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 min-w-0 text-sm rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="flex-1 text-sm rounded-lg py-2"
                  style={{ border: "1px solid #BAE6FD", color: "#5B7A90", fontWeight: 700 }}
                >
                  비우기
                </button>
                <button
                  onClick={submitDates}
                  className="flex-1 text-sm rounded-lg py-2"
                  style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {budgetModalOpen && (
        <BudgetModal
          budget={region.budget}
          canEdit={canEdit}
          onAdd={onAddBudgetItem}
          onDelete={onDeleteBudgetItem}
          onClose={() => setBudgetModalOpen(false)}
        />
      )}
    </div>
  );
}
