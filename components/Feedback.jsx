"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getNickname, ensureNickname } from "@/lib/nickname";

const SKY = "#0EA5E9";

export default function Feedback({ targetKey }) {
  const [reactions, setReactions] = useState([]);
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    setNickname(getNickname());
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from("reactions").select("*").eq("target_key", targetKey),
        supabase.from("comments").select("*").eq("target_key", targetKey).order("created_at", { ascending: true }),
      ]);
      if (!active) return;
      setReactions(r || []);
      setComments(c || []);
    }
    load();

    const channel = supabase
      .channel(`feedback:${targetKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions", filter: `target_key=eq.${targetKey}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `target_key=eq.${targetKey}` }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [targetKey]);

  const up = reactions.filter((r) => r.value === 1).length;
  const down = reactions.filter((r) => r.value === -1).length;
  const myVote = reactions.find((r) => r.nickname === nickname)?.value;

  async function vote(value) {
    const nick = ensureNickname();
    if (!nick) return;
    setNickname(nick);
    if (myVote === value) {
      await supabase.from("reactions").delete().eq("target_key", targetKey).eq("nickname", nick);
    } else {
      await supabase.from("reactions").upsert({ target_key: targetKey, nickname: nick, value }, { onConflict: "target_key,nickname" });
    }
  }

  async function submitComment() {
    const nick = ensureNickname();
    if (!nick || !text.trim()) return;
    setNickname(nick);
    await supabase.from("comments").insert({ target_key: targetKey, nickname: nick, body: text.trim() });
    setText("");
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      <div className="flex items-center gap-3 text-[12px]">
        <button onClick={() => vote(1)} className="flex items-center gap-1" style={{ color: myVote === 1 ? SKY : "#5B7A90" }}>
          <ThumbsUp size={13} /> {up}
        </button>
        <button onClick={() => vote(-1)} className="flex items-center gap-1" style={{ color: myVote === -1 ? "#EF4444" : "#5B7A90" }}>
          <ThumbsDown size={13} /> {down}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1" style={{ color: "#5B7A90" }}>
          <MessageCircle size={13} /> 댓글 {comments.length}
        </button>
      </div>

      {open && (
        <div className="rounded-lg p-2" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <div className="flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="text-[12px]">
                <span style={{ fontWeight: 700, color: "#0F2A3D" }}>{c.nickname}</span>{" "}
                <span style={{ color: "#5B7A90" }}>{c.body}</span>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-[12px]" style={{ color: "#94A9B8" }}>
                아직 댓글이 없어요
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="의견을 남겨보세요"
              className="flex-1 text-[12px] rounded px-2 py-1"
              style={{ border: "1px solid #BAE6FD" }}
            />
            <button onClick={submitComment} className="text-[12px] px-2.5 rounded" style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}>
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
