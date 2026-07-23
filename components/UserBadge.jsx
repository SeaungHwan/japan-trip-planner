"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";

export default function UserBadge() {
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    getIdentity().then(setIdentity);
  }, []);

  if (!identity) return null;

  return (
    <div className="flex items-center justify-between mb-2 text-xs">
      <span style={{ color: "#5B7A90" }}>{identity.nickname}님</span>
      <button
        onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-1"
        style={{ color: "#94A9B8", fontWeight: 700 }}
      >
        <LogOut size={12} /> 로그아웃
      </button>
    </div>
  );
}
