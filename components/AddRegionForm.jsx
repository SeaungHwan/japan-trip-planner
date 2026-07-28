"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";
import { compressImage } from "@/lib/imageOptimize";
import IconButton from "@/components/IconButton";
import LazyImage from "@/components/LazyImage";

function base64ToFile(base64, mimeType, name) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new File([bytes], name, { type: mimeType });
}

// AI 생성이 텍스트+사진+음식까지 합쳐 15~25초 걸릴 수 있어서, 그냥 "생성 중..."만
// 띄우면 멈춘 것처럼 보입니다. 실제 진행 단계와 정확히 맞물리진 않지만, 실제로 하고
// 있는 작업 순서를 반영한 문구를 돌아가며 보여줘서 계속 진행 중이라는 걸 알립니다.
const LOADING_MESSAGES = [
  "지역 정보를 살펴보는 중...",
  "가볼만한 명소를 찾는 중...",
  "대표 음식을 조사하는 중...",
  "여행 일정을 구성하는 중...",
  "대표 사진을 찾는 중...",
];

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="rounded mb-2 h-[320px] bg-sky-bg border border-sky-border" />,
});

export default function AddRegionForm({ onClose, onAdded, tripId }) {
  const [closing, setClosing] = useState(false);
  const [kr, setKr] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [jp, setJp] = useState("");
  const [spotsText, setSpotsText] = useState("");
  const [aiSpots, setAiSpots] = useState(null);
  const [foodsText, setFoodsText] = useState("");
  const [aiFoods, setAiFoods] = useState(null);
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(null);
  const [days, setDays] = useState(null);
  const [flightIncheon, setFlightIncheon] = useState("");
  const [flightCheongju, setFlightCheongju] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  function requestClose() {
    setClosing(true);
  }

  function handleBackdropAnimationEnd(e) {
    if (closing && e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    if (!generating) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [generating]);

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
      setFoodsText((data.foods || []).map((f) => f.name).join(", "));
      setAiFoods(data.foods);
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
      .filter(Boolean)
      .map((name) => {
        const match = aiFoods?.find((f) => f.name === name);
        return match?.imageUrl ? { name, imageUrl: match.imageUrl } : { name };
      });
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
    requestClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,42,61,0.5)] ${closing ? "modal-backdrop-out" : "modal-backdrop-in"}`}
      onAnimationEnd={handleBackdropAnimationEnd}
    >
      <div
        className={`w-full max-w-sm rounded-2xl min-h-[30vh] max-h-[90vh] flex flex-col bg-white ${closing ? "modal-card-out" : "modal-card-in"}`}
      >
        <div className="flex items-center justify-between p-4 pb-3 shrink-0">
          <span className="text-base text-ink font-bold">
            새 지역 추가
          </span>
          <IconButton onClick={requestClose} ariaLabel="닫기">
            <X size={23} color="#5B7A90" />
          </IconButton>
        </div>

        <div className="px-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <label className="block text-[12px] mb-1 text-muted">
            지역 이름 (필수)
          </label>
          <input
            value={kr}
            onChange={(e) => setKr(e.target.value)}
            placeholder="예: 벳푸"
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />

          <label className="block text-[12px] mb-1 text-muted">
            AI에게 추가 요청사항 (선택)
          </label>
          <textarea
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="예: 아이랑 가기 좋은 곳 위주로, 온천 위주로, 조용한 곳으로"
            rows={2}
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />

          {generating ? (
            <div
              className="w-full rounded-lg mb-3 p-3 flex flex-col items-center gap-2 bg-sky-bg border border-sky-border"
            >
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
              onClick={generateWithAI}
              className="w-full text-[12px] rounded-lg py-1.5 mb-3 flex items-center justify-center gap-1 bg-sky-bg text-sky font-bold border border-sky-border"
            >
              <Sparkles size={13} /> AI로 지도 위치 · 일정 · 항공편 · 메모 자동 생성
            </button>
          )}
          {days?.length > 0 && (
            <p className="text-[12px] mb-2 text-sky">
              {days.length}일 일정이 자동 생성됐어요. 저장하면 일정에 반영됩니다.
            </p>
          )}
          {imageUrl && (
            <LazyImage
              key={imageUrl}
              src={imageUrl}
              alt="지역 대표 이미지 미리보기"
              className="w-full rounded-lg mb-2"
              style={{ height: 160 }}
            />
          )}

          <label className="block text-[12px] mb-1 text-muted">
            일본어 이름 (선택)
          </label>
          <input
            value={jp}
            onChange={(e) => setJp(e.target.value)}
            placeholder="예: 別府"
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />

          <label className="block text-[12px] mb-1 text-muted">
            지도 위치 (필수) — AI 생성 시 자동으로 찍히며, 아래 지도를 클릭해서 직접 조정할 수도 있어요
          </label>
          <LocationPicker point={point} onPick={setPoint} />

          <label className="block text-[12px] mb-1 text-muted">
            가볼만한 곳 (선택, 쉼표로 구분)
          </label>
          <input
            value={spotsText}
            onChange={(e) => setSpotsText(e.target.value)}
            placeholder="예: 벳푸 지옥온천, 유노하나 마을"
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />
          {aiSpots?.length > 0 && (
            <p className="text-[11px] mb-2 text-faint">
              이름을 그대로 두면 AI가 찾은 위치도 같이 저장돼요. 새로 적거나 고치면 위치 없이 저장됩니다.
            </p>
          )}

          <label className="block text-[12px] mb-1 text-muted">
            지역 음식 (선택, 쉼표로 구분)
          </label>
          <input
            value={foodsText}
            onChange={(e) => setFoodsText(e.target.value)}
            placeholder="예: 벚꽃새우 덮밥, 우나기 파이"
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />
          {aiFoods?.some((f) => f.imageUrl) && (
            <p className="text-[11px] mb-2 text-faint">
              이름을 그대로 두면 AI가 찾은 사진도 같이 저장돼요. 새로 적거나 고치면 사진 없이 저장됩니다.
            </p>
          )}

          <label className="block text-[12px] mb-1 text-muted">
            항공편 정보 (선택)
          </label>
          <input
            value={flightIncheon}
            onChange={(e) => setFlightIncheon(e.target.value)}
            placeholder="인천 출발 — 예: 대한항공 주3회 (약 2시간)"
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />
          <input
            value={flightCheongju}
            onChange={(e) => setFlightCheongju(e.target.value)}
            placeholder="청주 출발 — 예: 정기 직항 없음"
            className="w-full text-sm rounded px-2 py-1.5 mb-1 border border-sky-border"
          />
          {(flightIncheon || flightCheongju) && (
            <p className="text-[11px] mb-2 text-faint">
              AI가 생성한 대략적인 정보예요. 예약 전 항공사 홈페이지에서 꼭 재확인해주세요.
            </p>
          )}

          <label className="block text-[12px] mb-1 text-muted">
            자유 메모 (선택)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이 지역을 추천하는 이유, 참고할 점 등"
            rows={3}
            className="w-full text-sm rounded px-2 py-1.5 mb-2 border border-sky-border"
          />
        </div>

        <div className="p-4 pt-3 shrink-0">
          {error && (
            <p className="text-[12px] mb-2 text-danger">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full text-sm rounded-lg py-2 bg-sky text-white font-bold"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "추가하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
