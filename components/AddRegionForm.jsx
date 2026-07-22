"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";

const SKY = "#0EA5E9";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 220, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

export default function AddRegionForm({ onClose, onAdded }) {
  const [kr, setKr] = useState("");
  const [jp, setJp] = useState("");
  const [spotsText, setSpotsText] = useState("");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(null);
  const [days, setDays] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generateWithAI() {
    if (!kr.trim()) {
      setError("지역 이름을 먼저 입력해주세요");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: kr.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setSpotsText(data.spots.join(", "));
      setNote(data.note);
      setPoint({ lat: data.lat, lng: data.lng });
      setDays(data.days);
    } catch (e) {
      setError(e.message);
    }
    setGenerating(false);
  }

  async function submit() {
    if (!kr.trim() || !point) {
      setError("지역 이름과 지도 위치는 필수예요");
      return;
    }
    const identity = await getIdentity();
    if (!identity) return;

    setSaving(true);
    setError("");
    const spots = spotsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { data, error: err } = await supabase
      .from("user_regions")
      .insert({
        kr: kr.trim(),
        jp: jp.trim() || null,
        lat: point.lat,
        lng: point.lng,
        note: note.trim() || null,
        spots,
        days: days || [],
        created_by: identity.nickname,
      })
      .select()
      .single();

    setSaving(false);
    if (err) {
      setError("저장에 실패했어요: " + err.message);
      return;
    }
    onAdded(data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,42,61,0.5)" }}>
      <div className="w-full max-w-sm rounded-2xl p-4 max-h-[90vh] overflow-y-auto" style={{ background: "#FFFFFF" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            새 지역 추가
          </span>
          <button onClick={onClose}>
            <X size={18} color="#5B7A90" />
          </button>
        </div>

        <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
          지역 이름 (필수)
        </label>
        <input
          value={kr}
          onChange={(e) => setKr(e.target.value)}
          placeholder="예: 벳푸"
          className="w-full text-sm rounded px-2 py-1.5 mb-2"
          style={{ border: "1px solid #BAE6FD" }}
        />

        <button
          onClick={generateWithAI}
          disabled={generating}
          className="w-full text-[12px] rounded-lg py-1.5 mb-3 flex items-center justify-center gap-1"
          style={{ background: "#F0F9FF", color: SKY, fontWeight: 700, border: "1px solid #BAE6FD", opacity: generating ? 0.6 : 1 }}
        >
          <Sparkles size={13} /> {generating ? "AI가 생성 중..." : "AI로 지도 위치 · 일정 · 메모 자동 생성"}
        </button>
        {days?.length > 0 && (
          <p className="text-[12px] mb-2" style={{ color: SKY }}>
            {days.length}일 일정이 자동 생성됐어요. 저장하면 일정 카드에 반영됩니다.
          </p>
        )}

        <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
          일본어 이름 (선택)
        </label>
        <input
          value={jp}
          onChange={(e) => setJp(e.target.value)}
          placeholder="예: 別府"
          className="w-full text-sm rounded px-2 py-1.5 mb-2"
          style={{ border: "1px solid #BAE6FD" }}
        />

        <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
          지도 위치 (필수) — AI 생성 시 자동으로 찍히며, 아래 지도를 클릭해서 직접 조정할 수도 있어요
        </label>
        <LocationPicker point={point} onPick={setPoint} />

        <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
          가볼만한 곳 (선택, 쉼표로 구분)
        </label>
        <input
          value={spotsText}
          onChange={(e) => setSpotsText(e.target.value)}
          placeholder="예: 벳푸 지옥온천, 유노하나 마을"
          className="w-full text-sm rounded px-2 py-1.5 mb-2"
          style={{ border: "1px solid #BAE6FD" }}
        />

        <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
          자유 메모 (선택)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="이 지역을 추천하는 이유, 참고할 점 등"
          rows={3}
          className="w-full text-sm rounded px-2 py-1.5 mb-2"
          style={{ border: "1px solid #BAE6FD" }}
        />

        {error && (
          <p className="text-[12px] mb-2" style={{ color: "#EF4444" }}>
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full text-sm rounded-lg py-2 mt-1"
          style={{ background: SKY, color: "#FFFFFF", fontWeight: 700, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "저장 중..." : "추가하기"}
        </button>
      </div>
    </div>
  );
}
