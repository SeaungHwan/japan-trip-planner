"use client";

import { useEffect, useState } from "react";
import { LogOut, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity, ALLOWED_DOMAIN } from "@/lib/auth";

export default function UserBadge() {
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    getIdentity().then(setIdentity);
  }, []);

  if (!identity) return null;

  // 자동 로그인 때문에 지금 어떤 구글 계정으로 들어와 있는지 헷갈릴 수 있어서,
  // 로그아웃 후 구글 계정 선택 화면(select_account)을 강제로 띄우는 버튼입니다.
  async function switchAccount() {
    await supabase.auth.signOut();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account", hd: ALLOWED_DOMAIN } },
    });
  }

  return (
    <div className="flex items-center justify-between mb-2 text-xs">
      <span style={{ color: "#5B7A90" }}>{identity.nickname}님</span>
      <div className="flex items-center gap-3">
        <button onClick={switchAccount} className="flex items-center gap-1" style={{ color: "#94A9B8", fontWeight: 700 }}>
          <LogIn size={12} /> 다른 계정으로 로그인
        </button>
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
