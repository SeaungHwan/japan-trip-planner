"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";
import { compressImage } from "@/lib/imageOptimize";

function base64ToFile(base64, mimeType, name) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new File([bytes], name, { type: mimeType });
}

const SKY = "#0EA5E9";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2" style={{ height: 220, background: "#F0F9FF", border: "1px solid #BAE6FD" }} />,
});

export default function AddRegionForm({ onClose, onAdded, tripId }) {
  const [kr, setKr] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [jp, setJp] = useState("");
  const [spotsText, setSpotsText] = useState("");
  const [aiSpots, setAiSpots] = useState(null);
  const [foodsText, setFoodsText] = useState("");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(null);
  const [days, setDays] = useState(null);
  const [flightIncheon, setFlightIncheon] = useState("");
  const [flightCheongju, setFlightCheongju] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  async function generateWithAI() {
    if (!kr.trim()) {
      setError("지역 이름을 먼저 입력해주세요");
      return;
    }
    setGenerating(true);
    setError("");
    setImageUrl(null);
    try {
      const res = await fetch("/api/generate-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: kr.trim(), extra: extraPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setJp(data.jp || "");
      setSpotsText(data.spots.map((s) => s.name).join(", "));
      setAiSpots(data.spots);
      setFoodsText((data.foods || []).join(", "));
      setNote(data.note);
      setPoint({ lat: data.lat, lng: data.lng });
      setDays(data.days);
      if (data.flight) {
        setFlightIncheon(data.flight.incheon);
        setFlightCheongju(data.flight.cheongju);
      }
      if (data.imageUrl) {
        // 위키피디아 실제 사진은 외부 URL을 그대로 씁니다.
        setImageUrl(data.imageUrl);
      } else if (data.imageBase64) {
        // 위키피디아에 사진이 없어서 AI가 생성한 경우만 우리 스토리지에 업로드해서
        // 영구적인 URL을 만듭니다(day-item-photos 버킷 재사용, 업로드 전 리사이즈/압축).
        try {
          const file = base64ToFile(data.imageBase64, data.imageMimeType || "image/png", "region-cover.png");
          const optimized = await compressImage(file);
          const path = `region-covers/${crypto.randomUUID()}-${optimized.name}`;
          const { error: upErr } = await supabase.storage.from("day-item-photos").upload(path, optimized);
          if (!upErr) {
            const { data: pub } = supabase.storage.from("day-item-photos").getPublicUrl(path);
            setImageUrl(pub.publicUrl);
          }
        } catch {
          // 이미지 없이도 지역 생성 자체는 계속 진행할 수 있어야 하므로 조용히 넘어갑니다.
        }
      }
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
    // AI가 준 이름을 그대로 뒀으면 그 좌표까지 같이 저장하고, 직접 새로 적거나 고친
    // 이름은 좌표 없이 저장합니다(기존처럼 나중에 지도에서 위치를 찍을 수 있음).
    const spots = spotsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => {
        const match = aiSpots?.find((s) => s.name === name);
        return match ? { name, lat: match.lat, lng: match.lng } : { name };
      });
    const foods = foodsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const flight =
      flightIncheon.trim() || flightCheongju.trim()
        ? { incheon: flightIncheon.trim() || "확인 필요", cheongju: flightCheongju.trim() || "확인 필요" }
        : null;

    const { data, error: err } = await supabase
      .from("user_regions")
      .insert({
        kr: kr.trim(),
        jp: jp.trim() || null,
        lat: point.lat,
        lng: point.lng,
        note: note.trim() || null,
        spots,
        foods,
        days: days || [],
        flight,
        image_url: imageUrl,
        trip_id: tripId,
        created_by: identity.nickname,
        user_id: identity.id,
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
      <div className="w-full max-w-sm rounded-2xl max-h-[90vh] flex flex-col" style={{ background: "#FFFFFF" }}>
        <div className="flex items-center justify-between p-4 pb-3 shrink-0">
          <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            새 지역 추가
          </span>
          <button onClick={onClose}>
            <X size={18} color="#5B7A90" />
          </button>
        </div>

        <div className="px-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
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

          <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
            AI에게 추가 요청사항 (선택)
          </label>
          <textarea
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="예: 아이랑 가기 좋은 곳 위주로, 온천 위주로, 조용한 곳으로"
            rows={2}
            className="w-full text-sm rounded px-2 py-1.5 mb-2"
            style={{ border: "1px solid #BAE6FD" }}
          />

          <button
            onClick={generateWithAI}
            disabled={generating}
            className="w-full text-[12px] rounded-lg py-1.5 mb-3 flex items-center justify-center gap-1"
            style={{ background: "#F0F9FF", color: SKY, fontWeight: 700, border: "1px solid #BAE6FD", opacity: generating ? 0.6 : 1 }}
          >
            <Sparkles size={13} /> {generating ? "AI가 생성 중..." : "AI로 지도 위치 · 일정 · 항공편 · 메모 자동 생성"}
          </button>
          {days?.length > 0 && (
            <p className="text-[12px] mb-2" style={{ color: SKY }}>
              {days.length}일 일정이 자동 생성됐어요. 저장하면 일정에 반영됩니다.
            </p>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="지역 대표 이미지 미리보기"
              className="w-full rounded-lg mb-2"
              style={{ maxHeight: 160, objectFit: "cover" }}
            />
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
          {aiSpots?.length > 0 && (
            <p className="text-[11px] mb-2" style={{ color: "#94A9B8" }}>
              이름을 그대로 두면 AI가 찾은 위치도 같이 저장돼요. 새로 적거나 고치면 위치 없이 저장됩니다.
            </p>
          )}

          <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
            지역 음식 (선택, 쉼표로 구분)
          </label>
          <input
            value={foodsText}
            onChange={(e) => setFoodsText(e.target.value)}
            placeholder="예: 벚꽃새우 덮밥, 우나기 파이"
            className="w-full text-sm rounded px-2 py-1.5 mb-2"
            style={{ border: "1px solid #BAE6FD" }}
          />

          <label className="block text-[12px] mb-1" style={{ color: "#5B7A90" }}>
            항공편 정보 (선택)
          </label>
          <input
            value={flightIncheon}
            onChange={(e) => setFlightIncheon(e.target.value)}
            placeholder="인천 출발 — 예: 대한항공 주3회 (약 2시간)"
            className="w-full text-sm rounded px-2 py-1.5 mb-2"
            style={{ border: "1px solid #BAE6FD" }}
          />
          <input
            value={flightCheongju}
            onChange={(e) => setFlightCheongju(e.target.value)}
            placeholder="청주 출발 — 예: 정기 직항 없음"
            className="w-full text-sm rounded px-2 py-1.5 mb-1"
            style={{ border: "1px solid #BAE6FD" }}
          />
          {(flightIncheon || flightCheongju) && (
            <p className="text-[11px] mb-2" style={{ color: "#94A9B8" }}>
              AI가 생성한 대략적인 정보예요. 예약 전 항공사 홈페이지에서 꼭 재확인해주세요.
            </p>
          )}

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
        </div>

        <div className="p-4 pt-3 shrink-0">
          {error && (
            <p className="text-[12px] mb-2" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full text-sm rounded-lg py-2"
            style={{ background: SKY, color: "#FFFFFF", fontWeight: 700, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "추가하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
