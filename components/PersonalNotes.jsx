"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";

const SKY = "#0EA5E9";

export default function PersonalNotes() {
  const [identity, setIdentity] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    getIdentity().then(setIdentity);
  }, []);

  useEffect(() => {
    if (!identity) return;
    let alive = true;

    async function load() {
      const { data } = await supabase
        .from("personal_notes")
        .select("*")
        .eq("user_id", identity.id)
        .order("created_at", { ascending: true });
      if (alive) setNotes(data || []);
    }
    load();

    const channel = supabase
      .channel(`personal_notes:${identity.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_notes", filter: `user_id=eq.${identity.id}` },
        load
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [identity]);

  async function addNote() {
    const body = draftText.trim();
    if (!body || !identity) return;
    await supabase.from("personal_notes").insert({ user_id: identity.id, body });
    setDraftText("");
    setShowAdd(false);
  }

  async function commitEdit(id) {
    const body = editText.trim();
    setEditingId(null);
    if (!body) return;
    await supabase.from("personal_notes").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function deleteNote(id) {
    if (!window.confirm("이 메모를 삭제할까요?")) return;
    await supabase.from("personal_notes").delete().eq("id", id);
  }

  if (!identity) return null;

  return (
    <>
    <div className="mb-4 anim-fadeup">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "#0F2A3D", fontWeight: 700 }}>
          <Lock size={13} color="#5B7A90" /> 내 메모 (나만 보여요)
        </span>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs flex items-center gap-1"
          style={{ color: SKY, fontWeight: 700 }}
        >
          <Plus size={13} /> 새 메모
        </button>
      </div>

      {notes.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              {editingId === n.id ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full text-[13px] rounded px-2 py-1.5"
                    style={{ border: "1px solid #BAE6FD", color: "#0F2A3D" }}
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      className="text-[12px] flex items-center gap-1"
                      style={{ color: SKY, fontWeight: 700 }}
                      onClick={() => commitEdit(n.id)}
                    >
                      완료
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13px] whitespace-pre-wrap" style={{ color: "#0F2A3D" }}>
                    {n.body}
                  </p>
                  <div className="flex items-center justify-end gap-3 mt-1.5">
                    <button
                      className="text-[12px] flex items-center gap-1"
                      style={{ color: SKY, fontWeight: 700 }}
                      onClick={() => {
                        setEditingId(n.id);
                        setEditText(n.body);
                      }}
                    >
                      <Pencil size={12} /> 편집
                    </button>
                    <button
                      className="text-[12px] flex items-center gap-1"
                      style={{ color: "#94A9B8", fontWeight: 700 }}
                      onClick={() => deleteNote(n.id)}
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {showAdd && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,42,61,0.5)" }}>
        <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: "#FFFFFF" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-base" style={{ color: "#0F2A3D", fontWeight: 700 }}>
              새 메모
            </span>
            <button onClick={() => setShowAdd(false)}>
              <X size={18} color="#5B7A90" />
            </button>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="나만 볼 수 있는 메모를 남겨보세요"
            rows={5}
            autoFocus
            className="w-full text-sm rounded px-2 py-1.5 mb-3"
            style={{ border: "1px solid #BAE6FD" }}
          />
          <button
            onClick={addNote}
            className="w-full text-sm rounded-lg py-2"
            style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
          >
            저장
          </button>
        </div>
      </div>
    )}
    </>
  );
}
