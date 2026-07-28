"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Modal from "@/components/Modal";
import LazyImage from "@/components/LazyImage";
import { SKY } from "@/lib/theme";

// AddRegionForm의 로딩 문구 로테이션과 같은 패턴이지만, 편집 요청은 처음부터 지역을
// 만드는 것보다 훨씬 가벼워서(요청과 관련된 부분만 새로 생성) 문구도 그에 맞춥니다.
const LOADING_MESSAGES = ["편집 요청을 반영하는 중...", "관련 정보를 찾는 중...", "사진을 찾는 중..."];

// 기존 지역에 저장된 데이터(spots/foods/note/flight/days)는 그대로 두고, AI에게
// 자유 프롬프트로 "추가 편집"만 요청하는 모달입니다. AI 결과는 바로 저장하지 않고
// 먼저 미리보기로 보여준 뒤, 사용자가 "적용"을 눌러야 실제로 저장됩니다 — 이미 저장된
// 여행 데이터를 덮어쓰는 작업이라 확인 없이 바로 반영하면 위험합니다.
export default function AIEditRegionModal({ region, onClose, onApply }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  useEffect(() => {
    if (!generating) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [generating]);

  async function requestEdit() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/edit-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: region.kr,
          jp: region.jp,
          note: region.note,
          lat: region.lat,
          lng: region.lng,
          flight: region.flight,
          spots: region.moreSpots,
          foods: region.foods,
          days: region.days,
          prompt: prompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "편집 실패");
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    await onApply(result);
    setApplying(false);
    onClose();
  }

  const hasChanges =
    result &&
    (result.newSpots.length > 0 ||
      result.newFoods.length > 0 ||
      result.newDays.length > 0 ||
      result.note !== region.note);

  return (
    <Modal icon={Sparkles} title="AI로 지역 편집" onClose={onClose}>
      <label className="block text-[12px] mb-1 text-muted">
        어떻게 편집할지 알려주세요
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="예: 라멘 맛집 3개 더 추천해줘, 일정 2일 더 추가해줘, 항공편 정보 다시 확인해줘"
        autoFocus
        disabled={generating}
        className="w-full h-[120px] text-[14px] rounded-lg p-3 mb-2 border border-sky-border text-ink resize-none outline-none"
      />

      {generating ? (
        <div className="w-full rounded-lg mb-3 p-3 flex flex-col items-center gap-2 bg-sky-bg border border-sky-border">
          <div className="ai-loading-icon text-sky">
            <Sparkles size={22} />
          </div>
          <p key={loadingMsgIndex} className="ai-loading-text text-[12px] text-sky font-bold">
            {LOADING_MESSAGES[loadingMsgIndex]}
          </p>
          <div className="ai-loading-bar-track">
            <div className="ai-loading-bar" />
          </div>
        </div>
      ) : (
        <button
          onClick={requestEdit}
          disabled={!prompt.trim()}
          className="w-full text-[12px] rounded-lg py-1.5 mb-3 flex items-center justify-center gap-1 bg-sky-bg text-sky font-bold border border-sky-border"
          style={{ opacity: prompt.trim() ? 1 : 0.6 }}
        >
          <Sparkles size={13} /> AI에게 편집 요청
        </button>
      )}

      {error && <p className="text-[12px] mb-2 text-danger">{error}</p>}

      {result && (
        <div className="flex flex-col gap-2 mb-3">
          {result.note !== region.note && (
            <div className="rounded-lg p-2 bg-slate-bg border border-slate-border">
              <p className="text-[11px] mb-1 text-faint">새 소개 문구</p>
              <p className="text-[12px] text-ink">{result.note}</p>
            </div>
          )}
          {result.newSpots.length > 0 && (
            <div>
              <p className="text-[11px] mb-1 text-faint">새로 추가될 명소</p>
              <div className="flex flex-wrap gap-1.5">
                {result.newSpots.map((s, i) => (
                  <span key={i} className="text-[12px] px-2 py-1 rounded-full bg-sky-bg border border-sky-border text-ink">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.newFoods.length > 0 && (
            <div>
              <p className="text-[11px] mb-1 text-faint">새로 추가될 음식</p>
              <div className="flex flex-wrap gap-1.5">
                {result.newFoods.map((f, i) => (
                  <span
                    key={i}
                    className="text-[12px] pl-2 pr-2.5 py-1 rounded-full flex items-center gap-1 bg-sky-bg border border-sky-border text-ink"
                  >
                    {f.imageUrl && <LazyImage key={f.imageUrl} src={f.imageUrl} className="w-4 h-4 rounded-full" />}
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.newDays.length > 0 && (
            <p className="text-[12px] text-sky">
              {result.newDays.length}일치 일정이 기존 일정 뒤에 새로 추가돼요.
            </p>
          )}
          {!hasChanges && (
            <p className="text-[12px] text-faint">
              편집 요청과 관련해서 새로 바뀌는 내용이 없어요. 요청 내용을 조금 더 구체적으로 적어보세요.
            </p>
          )}
          <button
            onClick={apply}
            disabled={!hasChanges || applying}
            className="w-full text-sm rounded-lg py-2 bg-sky text-white font-bold"
            style={{ opacity: hasChanges && !applying ? 1 : 0.5 }}
          >
            {applying ? "적용하는 중..." : "적용하기"}
          </button>
        </div>
      )}
    </Modal>
  );
}
