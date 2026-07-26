"use client";

import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { getIcon } from "@/data/icons";
import Feedback from "@/components/Feedback";
import SettlementModal from "@/components/SettlementModal";

const SKY = "#0EA5E9";

export default function RegionHeader({ region, onDelete, canEdit, onAddBudgetItem, onDeleteBudgetItem, onSaveParticipants }) {
  const Icon = getIcon(region.icon);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

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
            <button onClick={() => setBudgetModalOpen(true)} aria-label="정산" className="flex items-center gap-1">
              <Wallet size={14} color="#94A9B8" />
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

      {budgetModalOpen && (
        <SettlementModal
          budget={region.budget}
          participants={region.participants}
          canEdit={canEdit}
          onAddItem={onAddBudgetItem}
          onDeleteItem={onDeleteBudgetItem}
          onSaveParticipants={onSaveParticipants}
          onClose={() => setBudgetModalOpen(false)}
        />
      )}
    </div>
  );
}
