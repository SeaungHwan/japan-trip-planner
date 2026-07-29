"use client";

import { useEffect, useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";
import IconButton from "@/components/IconButton";
import { SKY, MUTED, DANGER } from "@/lib/theme";

export default function Feedback({ targetKey }) {
  const [reactions, setReactions] = useState([]);
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdentity().then(setIdentity);
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
      setLoading(false);
    }
    load();

    // day_item_notes/user_regions와 같은 이유로 필터를 안 겁니다: DELETE 이벤트는 기본
    // REPLICA IDENTITY에서 target_key 없이 기본키만 실려오므로, target_key로 필터링하면
    // 삭제 이벤트 자체가 조용히 무시됩니다. load()가 이미 targetKey로 좁혀서 다시
    // 받아오므로, 다른 지역에서 일어난 변경으로 재조회가 한 번 더 일어나는 정도의
    // 비용만 남고 결과 자체는 정확합니다.
    const channel = supabase
      .channel(`feedback:${targetKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [targetKey]);

  // text 입력(댓글 작성) 등 reactions와 무관한 상태가 바뀔 때마다 다시 세지 않도록
  // reactions/identity가 바뀔 때만 계산합니다.
  const { up, down, myVote } = useMemo(
    () => ({
      up: reactions.filter((r) => r.value === 1).length,
      down: reactions.filter((r) => r.value === -1).length,
      myVote: reactions.find((r) => r.user_id === identity?.id)?.value,
    }),
    [reactions, identity]
  );

  async function vote(value) {
    if (!identity) return;
    if (myVote === value) {
      await supabase.from("reactions").delete().eq("target_key", targetKey).eq("user_id", identity.id);
    } else {
      await supabase
        .from("reactions")
        .upsert({ target_key: targetKey, user_id: identity.id, nickname: identity.nickname, value }, { onConflict: "target_key,user_id" });
    }
  }

  async function submitComment() {
    if (!identity || !text.trim()) return;
    await supabase.from("comments").insert({ target_key: targetKey, user_id: identity.id, nickname: identity.nickname, body: text.trim() });
    setText("");
  }

  async function deleteComment(id) {
    await supabase.from("comments").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      <div className="flex items-center justify-end gap-1 text-[12px]">
        <button
          onClick={() => vote(1)}
          aria-pressed={myVote === 1}
          className="flex items-center gap-1 rounded-full px-1 py-0.5"
          style={{
            color: myVote === 1 ? "#FFFFFF" : MUTED,
            background: myVote === 1 ? SKY : "transparent",
            fontWeight: myVote === 1 ? 700 : 400,
          }}
        >
          <ThumbsUp size={13} /> {loading ? "-" : up}
        </button>
        <button
          onClick={() => vote(-1)}
          aria-pressed={myVote === -1}
          className="flex items-center gap-1 rounded-full px-1 py-0.5"
          style={{
            color: myVote === -1 ? "#FFFFFF" : MUTED,
            background: myVote === -1 ? DANGER : "transparent",
            fontWeight: myVote === -1 ? 700 : 400,
          }}
        >
          <ThumbsDown size={13} /> {loading ? "-" : down}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-muted">
          <MessageCircle size={13} /> 댓글 {loading ? "-" : comments.length}
        </button>
      </div>

      {open && (
        <div className="rounded-lg p-2 bg-slate-bg border border-slate-border">
          <div className="no-auto-phrase flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-1.5 text-[12px]">
                <span className="shrink-0 font-bold text-ink">
                  {c.nickname}
                </span>
                <span className="flex-1 min-w-0 text-muted">
                  {c.body}
                </span>
                {c.user_id === identity?.id && (
                  <IconButton onClick={() => deleteComment(c.id)} ariaLabel="댓글 삭제">
                    <X size={15} color="#94A9B8" />
                  </IconButton>
                )}
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-[12px] text-faint">
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
              className="flex-1 text-[12px] rounded px-2 py-1 border border-sky-border"
            />
            <button onClick={submitComment} className="text-[12px] px-2.5 rounded bg-sky text-white font-bold">
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
