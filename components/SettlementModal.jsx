"use client";

import { useMemo, useState } from "react";
import { Wallet, Users, Plus, X, ArrowRight } from "lucide-react";
import Modal from "@/components/Modal";

const SKY = "#0EA5E9";

function won(n) {
  return `${Math.round(n || 0).toLocaleString()}원`;
}

// 각 항목의 amount를 참가자별 부담액으로 환산합니다. splitMode가 "custom"이면 직접
// 입력한 금액을, 아니면 그 항목에 걸린 참가자 수만큼 균등하게 나눕니다.
function shareFor(item, person) {
  if (item.splitMode === "custom") return Number(item.customSplits?.[person]) || 0;
  const parts = item.participants?.length ? item.participants : [];
  if (!parts.includes(person)) return 0;
  return (Number(item.amount) || 0) / parts.length;
}

function computeBalances(budget, participants) {
  return participants.map((p) => {
    const paid = (budget || []).reduce((sum, item) => sum + (item.payer === p ? Number(item.amount) || 0 : 0), 0);
    const owed = (budget || []).reduce((sum, item) => sum + shareFor(item, p), 0);
    return { name: p, paid, owed, balance: paid - owed };
  });
}

// 잔액이 +인 사람(받을 돈)과 -인 사람(낼 돈)을 그리디하게 짝지어서 "누가 누구에게
// 얼마"의 최소 송금 목록을 만듭니다. 항목별로 정확히 나누지 않고 순잔액만 맞추는
// 방식이라 실제 각자의 지출 내역과는 별개로, 정산에 필요한 이체만 계산합니다.
function computeTransfers(balances) {
  const creditors = balances.filter((b) => b.balance > 0.5).map((b) => ({ ...b })).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter((b) => b.balance < -0.5).map((b) => ({ ...b, balance: -b.balance })).sort((a, b) => b.balance - a.balance);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].balance, creditors[j].balance);
    if (pay > 0.5) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    debtors[i].balance -= pay;
    creditors[j].balance -= pay;
    if (debtors[i].balance <= 0.5) i++;
    if (creditors[j].balance <= 0.5) j++;
  }
  return transfers;
}

export default function SettlementModal({ budget, participants, canEdit, onAddItem, onDeleteItem, onSaveParticipants, onClose }) {
  const list = participants || [];

  const [newParticipant, setNewParticipant] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [splitWith, setSplitWith] = useState(list);
  const [splitMode, setSplitMode] = useState("equal");
  const [customAmounts, setCustomAmounts] = useState({});

  const total = (budget || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  // budget/participants가 그대론데 입력 폼(이름/금액/직접입력 등)에 타이핑할 때마다
  // 다시 계산되지 않도록 memo합니다. 항목 수가 늘어날수록 이 계산 비용도 커집니다.
  const balances = useMemo(() => computeBalances(budget, list), [budget, list]);
  const transfers = useMemo(() => computeTransfers(balances), [balances]);

  function addParticipant() {
    const trimmed = newParticipant.trim();
    if (!trimmed || list.includes(trimmed)) return;
    const next = [...list, trimmed];
    onSaveParticipants(next);
    setSplitWith(next);
    setNewParticipant("");
  }

  function removeParticipant(p) {
    onSaveParticipants(list.filter((x) => x !== p));
    setSplitWith((prev) => prev.filter((x) => x !== p));
  }

  function toggleSplitWith(p) {
    setSplitWith((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function submitAdd() {
    if (!name.trim() || splitWith.length === 0) return;
    onAddItem({
      name: name.trim(),
      amount: Number(amount) || 0,
      payer: payer || null,
      participants: splitWith,
      splitMode,
      customSplits: splitMode === "custom" ? customAmounts : {},
    });
    setName("");
    setAmount("");
    setPayer("");
    setSplitWith(list);
    setSplitMode("equal");
    setCustomAmounts({});
  }

  const customSum = splitWith.reduce((sum, p) => sum + (Number(customAmounts[p]) || 0), 0);

  return (
    <Modal icon={Wallet} title="정산" onClose={onClose}>
          {/* 참가자 */}
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1.5 text-[12px]" style={{ color: "#5B7A90", fontWeight: 700 }}>
              <Users size={12} /> 참가자
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {list.map((p) => (
                <span
                  key={p}
                  className="text-[12px] pl-2 pr-1 py-1 rounded-full flex items-center gap-1"
                  style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                >
                  {p}
                  {canEdit && (
                    <button onClick={() => removeParticipant(p)} aria-label={`${p} 삭제`}>
                      <X size={10} color="#94A9B8" />
                    </button>
                  )}
                </span>
              ))}
              {list.length === 0 && (
                <span className="text-[11px]" style={{ color: "#94A9B8" }}>
                  참가자를 추가하면 항목별로 나눠 낼 수 있어요
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5">
                <input
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                  placeholder="이름 (예: 철수)"
                  className="flex-1 min-w-0 text-[12px] rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <button onClick={addParticipant} aria-label="참가자 추가" className="shrink-0">
                  <Plus size={16} color={SKY} />
                </button>
              </div>
            )}
          </div>

          {/* 비용 항목 */}
          <ul className="flex flex-col gap-1.5 mb-2">
            {(budget || []).map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div className="min-w-0">
                  <div className="text-[13px] truncate" style={{ color: "#0F2A3D" }}>
                    {b.name}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "#94A9B8" }}>
                    {b.payer ? `${b.payer} 냄 · ` : ""}
                    {(b.participants || []).join(", ")}
                    {b.splitMode === "custom" ? " (직접입력)" : " 균등"}
                  </div>
                </div>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px]" style={{ color: "#5B7A90", fontWeight: 700 }}>
                    {won(b.amount)}
                  </span>
                  {canEdit && (
                    <button onClick={() => onDeleteItem(i)} aria-label="항목 삭제">
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
              {won(total)}
            </span>
          </div>

          {/* 새 비용 추가 */}
          {canEdit && list.length > 0 && (
            <div className="rounded-lg p-2.5 mb-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="항목 (예: 항공권)"
                  className="flex-1 min-w-0 text-[12px] rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  placeholder="금액"
                  className="w-20 shrink-0 text-[12px] rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD" }}
                />
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] shrink-0" style={{ color: "#5B7A90" }}>
                  낸 사람
                </span>
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                  className="flex-1 min-w-0 text-[12px] rounded px-2 py-1.5"
                  style={{ border: "1px solid #BAE6FD", color: payer ? "#0F2A3D" : "#94A9B8" }}
                >
                  <option value="">선택 안 함</option>
                  {list.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-1.5">
                <span className="text-[11px]" style={{ color: "#5B7A90" }}>
                  나눌 사람
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {list.map((p) => {
                    const on = splitWith.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => toggleSplitWith(p)}
                        className="text-[11px] px-2 py-1 rounded-full"
                        style={{
                          background: on ? SKY : "#FFFFFF",
                          color: on ? "#FFFFFF" : "#5B7A90",
                          border: `1px solid ${on ? SKY : "#BAE6FD"}`,
                          fontWeight: on ? 700 : 500,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <button
                  onClick={() => setSplitMode("equal")}
                  className="flex-1 text-[11px] rounded py-1"
                  style={{
                    background: splitMode === "equal" ? SKY : "#FFFFFF",
                    color: splitMode === "equal" ? "#FFFFFF" : "#5B7A90",
                    border: `1px solid ${splitMode === "equal" ? SKY : "#BAE6FD"}`,
                    fontWeight: 700,
                  }}
                >
                  균등하게 ({splitWith.length || 0}등분)
                </button>
                <button
                  onClick={() => setSplitMode("custom")}
                  className="flex-1 text-[11px] rounded py-1"
                  style={{
                    background: splitMode === "custom" ? SKY : "#FFFFFF",
                    color: splitMode === "custom" ? "#FFFFFF" : "#5B7A90",
                    border: `1px solid ${splitMode === "custom" ? SKY : "#BAE6FD"}`,
                    fontWeight: 700,
                  }}
                >
                  직접 입력
                </button>
              </div>

              {splitMode === "custom" && splitWith.length > 0 && (
                <div className="flex flex-col gap-1 mb-1.5">
                  {splitWith.map((p) => (
                    <div key={p} className="flex items-center gap-1.5">
                      <span className="text-[11px] w-12 shrink-0 truncate" style={{ color: "#5B7A90" }}>
                        {p}
                      </span>
                      <input
                        value={customAmounts[p] ?? ""}
                        onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [p]: e.target.value }))}
                        type="number"
                        placeholder="금액"
                        className="flex-1 min-w-0 text-[12px] rounded px-2 py-1"
                        style={{ border: "1px solid #BAE6FD" }}
                      />
                    </div>
                  ))}
                  <div className="text-[11px] text-right" style={{ color: customSum === Number(amount) ? "#5B7A90" : "#EF4444" }}>
                    입력 합계 {won(customSum)} / 총액 {won(Number(amount) || 0)}
                  </div>
                </div>
              )}

              <button
                onClick={submitAdd}
                className="w-full rounded-lg py-1.5 text-[12px] flex items-center justify-center gap-1"
                style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
              >
                <Plus size={13} /> 추가
              </button>
            </div>
          )}

          {/* 정산 요약 */}
          {list.length > 0 && (
            <div>
              <div className="text-[12px] mb-1.5" style={{ color: "#5B7A90", fontWeight: 700 }}>
                정산 요약
              </div>
              <ul className="flex flex-col gap-1 mb-2">
                {balances.map((b) => (
                  <li key={b.name} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: "#0F2A3D" }}>{b.name}</span>
                    <span style={{ color: b.balance >= 0 ? "#0EA5E9" : "#EF4444", fontWeight: 700 }}>
                      {b.balance >= 0 ? `+${won(b.balance)} 받음` : `${won(b.balance)} 냄`}
                    </span>
                  </li>
                ))}
              </ul>
              {transfers.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {transfers.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1.5"
                      style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                    >
                      {t.from} <ArrowRight size={12} color="#94A9B8" /> {t.to}
                      <span className="ml-auto" style={{ fontWeight: 700 }}>
                        {won(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                (budget || []).length > 0 && (
                  <p className="text-[11px]" style={{ color: "#94A9B8" }}>
                    이미 정산이 맞아요
                  </p>
                )
              )}
            </div>
          )}
    </Modal>
  );
}
