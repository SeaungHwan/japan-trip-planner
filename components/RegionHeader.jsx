"use client";

import { useState } from "react";
import { Trash2, Wallet, FileText } from "lucide-react";
import { getIcon } from "@/data/icons";
import Feedback from "@/components/Feedback";
import SettlementModal from "@/components/SettlementModal";
import MemoModal from "@/components/MemoModal";
import IconButton from "@/components/IconButton";
import { SKY } from "@/lib/theme";

export default function RegionHeader({ region, onDelete, canEdit, onAddBudgetItem, onDeleteBudgetItem, onSaveParticipants, memo, onSaveMemo }) {
  const Icon = getIcon(region.icon);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  return (
    <div className="mb-3 anim-fadeup" key={region.id}>
      <div className="flex items-center gap-2">
        <Icon size={18} color={SKY} />
        <span className="text-lg serif text-ink font-bold">
          {region.kr}
        </span>
        <span className="text-xs text-faint">
          {region.jp}
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {canEdit && (
            <IconButton onClick={() => setMemoOpen(true)} ariaLabel="메모장">
              <FileText size={18} color="#94A9B8" />
            </IconButton>
          )}
          {canEdit && (
            <IconButton onClick={() => setBudgetModalOpen(true)} ariaLabel="정산">
              <Wallet size={18} color="#94A9B8" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton onClick={onDelete} ariaLabel="지역 삭제">
              <Trash2 size={19} color="#94A9B8" />
            </IconButton>
          )}
        </div>
      </div>
      {region.note && (
        <p className="text-[13px] mt-1 text-muted">
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

      {memoOpen && <MemoModal memo={memo} onSave={onSaveMemo} onClose={() => setMemoOpen(false)} />}
    </div>
  );
}
