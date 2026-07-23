"use client";

import { useEffect, useState } from "react";
import { LogOut, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";

const SKY = "#0EA5E9";

export default function UserBadge({ canShare, isShared, onToggleShare }) {
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    getIdentity().then(setIdentity);
  }, []);

  if (!identity) return null;

  return (
    <div className="flex items-center justify-between mb-2 text-xs">
      <span style={{ color: "#5B7A90" }}>{identity.nickname}님</span>
      <div className="flex items-center gap-3">
        {canShare && (
          <button
            onClick={onToggleShare}
            className="flex items-center gap-1"
            style={{ color: isShared ? SKY : "#94A9B8", fontWeight: 700 }}
          >
            <Share2 size={12} /> {isShared ? "공유 중" : "공유하기"}
          </button>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1"
          style={{ color: "#94A9B8", fontWeight: 700 }}
        >
          <LogOut size={12} /> 로그아웃
        </button>
      </div>
    </div>
  );
}
