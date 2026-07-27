"use client";

import { useEffect, useState } from "react";
import { LogOut, Share2, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getIdentity } from "@/lib/auth";
import WeatherBadge from "@/components/WeatherBadge";
import { SKY, FAINT, SKY_BG } from "@/lib/theme";

const LEVELS = [
  { value: "private", label: "비공개" },
  { value: "view", label: "공유" },
  { value: "edit", label: "편집 공유" },
];

export default function UserBadge({ canShare, shareLevel, onSetShareLevel, weatherLat, weatherLng, startDate, endDate }) {
  const [identity, setIdentity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getIdentity().then(setIdentity);
  }, []);

  if (!identity) return null;

  const current = LEVELS.find((l) => l.value === shareLevel) || LEVELS[0];

  return (
    <div className="flex items-center justify-between mb-3 text-xs">
      <span className="text-muted">{identity.nickname}님</span>
      <div className="flex items-center gap-3">
        <WeatherBadge lat={weatherLat} lng={weatherLng} startDate={startDate} endDate={endDate} />
        {canShare && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 font-bold"
              style={{ color: shareLevel === "private" ? FAINT : SKY }}
            >
              <Share2 size={12} /> {current.label}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden bg-white border border-sky-border min-w-[140px]"
                >
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => {
                        onSetShareLevel(l.value);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-ink"
                      style={{ background: l.value === shareLevel ? SKY_BG : "transparent" }}
                    >
                      {l.label}
                      {l.value === shareLevel && <Check size={12} color={SKY} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1 text-faint font-bold"
        >
          <LogOut size={12} /> 로그아웃
        </button>
      </div>
    </div>
  );
}
