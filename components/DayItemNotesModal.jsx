"use client";

import { useEffect, useState } from "react";
import { X, Trash2, ImagePlus } from "lucide-react";
import { compressImage } from "@/lib/imageOptimize";

const SKY = "#0EA5E9";

export default function DayItemNotesModal({ itemText, notes, canEdit, onAdd, onDelete, onClose }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canEdit) return;
    function handlePaste(e) {
      const pasted = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith("image/"))?.getAsFile();
      if (pasted) {
        e.preventDefault();
        setFile(pasted);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [canEdit]);

  async function submit() {
    if (!text.trim() && !file) return;
    setSubmitting(true);
    setError("");
    try {
      const optimizedFile = file ? await compressImage(file) : null;
      await onAdd(text.trim(), optimizedFile);
      setText("");
      setFile(null);
    } catch (e) {
      setError("저장에 실패했어요: " + e.message);
    }
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,42,61,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            {itemText}
          </span>
          <button onClick={onClose} className="shrink-0 ml-2" aria-label="닫기">
            <X size={18} color="#5B7A90" />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {notes.length === 0 && (
            <p className="text-[12px]" style={{ color: "#94A9B8" }}>
              아직 메모/사진이 없어요.
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg p-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {n.photo_url && (
                    <img src={n.photo_url} alt="" loading="lazy" className="rounded mb-1.5 w-full object-cover" style={{ maxHeight: 200 }} />
                  )}
                  {n.text && (
                    <p className="text-[13px] whitespace-pre-wrap" style={{ color: "#0F2A3D" }}>
                      {n.text}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => onDelete(n.id)} aria-label="삭제" className="shrink-0">
                    <Trash2 size={13} color="#94A9B8" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="pt-2" style={{ borderTop: "1px solid #E2E8F0" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메모 입력 (선택)"
              rows={2}
              className="w-full text-sm rounded px-2 py-1.5 mb-2"
              style={{ border: "1px solid #BAE6FD" }}
            />
            <div className="flex items-center gap-2">
              <label
                className="text-[12px] flex items-center gap-1 rounded px-2 py-1.5 cursor-pointer shrink-0"
                style={{ border: "1px solid #BAE6FD", color: "#5B7A90" }}
              >
                <ImagePlus size={13} />
                {file ? file.name : "사진 선택 (또는 Ctrl+V로 붙여넣기)"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <button
                onClick={submit}
                disabled={submitting || (!text.trim() && !file)}
                className="flex-1 text-[12px] rounded-lg py-1.5"
                style={{
                  background: SKY,
                  color: "#FFFFFF",
                  fontWeight: 700,
                  opacity: submitting || (!text.trim() && !file) ? 0.5 : 1,
                }}
              >
                {submitting ? "저장 중..." : "추가"}
              </button>
            </div>
            {file && (
              <p className="text-[11px] mt-1" style={{ color: "#94A9B8" }}>
                사진은 업로드 전 자동으로 리사이즈/압축돼요.
              </p>
            )}
            {error && (
              <p className="text-[12px] mt-1.5" style={{ color: "#EF4444" }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
