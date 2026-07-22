"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { MAP_IMAGE_URL } from "@/data/regions";
import { supabase } from "@/lib/supabaseClient";
import { ensureNickname } from "@/lib/nickname";

const SKY = "#0EA5E9";

export default function AddRegionForm({ onClose, onAdded }) {
  const imgRef = useRef(null);
  const [kr, setKr] = useState("");
  const [jp, setJp] = useState("");
  const [spotsText, setSpotsText] = useState("");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function pickPoint(e) {
    const rect = imgRef.current.getBoundingClientRect();
    setPoint({
      x: +(((e.clientX - rect.left) / rect.width) * 100).toFixed(2),
      y: +(((e.clientY - rect.top) / rect.height) * 100).toFixed(2),
    });
  }

  async function submit() {
    if (!kr.trim() || !point) {
      setError("지역 이름과 지도 위치는 필수예요");
      return;
    }
    const nick = ensureNickname();
    if (!nick) return;

    setSaving(true);
    setError("");
    const spots = spotsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { data, error: err } = await supabase
      .from("user_regions")
      .insert({ kr: kr.trim(), jp: jp.trim() || null, x: point.x, y: point.y, note: note.trim() || null, spots, created_by: nick })
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
          지도 위치 (필수) — 아래 지도를 클릭해서 위치를 찍어주세요
        </label>
        <div className="relative select-none mb-2" style={{ cursor: "crosshair" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={MAP_IMAGE_URL} alt="일본 지도" draggable="false" onClick={pickPoint} className="w-full block rounded" />
          {point && (
            <span
              className="absolute rounded-full"
              style={{ left: `${point.x}%`, top: `${point.y}%`, width: 10, height: 10, background: "#EF4444", border: "2px solid #fff", transform: "translate(-50%,-50%)" }}
            />
          )}
        </div>

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
