"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";
import { ALLOWED_DOMAIN } from "@/lib/auth";
import { Plane } from "lucide-react";

const SKY_GRADIENT = "linear-gradient(180deg, #E0F2FE 0%, #F0F9FF 55%, #FFFFFF 100%)";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.61z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => checkDomain(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => checkDomain(newSession));
    return () => subscription.unsubscribe();
  }, []);

  async function checkDomain(newSession) {
    if (newSession) {
      if (!newSession.user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        setError(`${ALLOWED_DOMAIN} 계정으로만 로그인할 수 있어요`);
        setSession(null);
        await supabase.auth.signOut();
        return;
      }
      setError("");
    }
    setSession(newSession);
  }

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { hd: ALLOWED_DOMAIN } },
    });
  }

  // 자동 로그인 때문에 지금 브라우저에 남아있는 계정으로 바로 들어가지는 걸 원치 않을 때,
  // 구글 계정 선택 화면(select_account)을 강제로 띄우는 버튼입니다.
  function signInAsDifferentAccount() {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account", hd: ALLOWED_DOMAIN } },
    });
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: SKY_GRADIENT }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4" style={{ background: SKY_GRADIENT }}>
        {/* 여행 느낌을 주는 배경 장식: 점선 항로. interaction/레이아웃에는 관여하지 않습니다. */}
        <svg
          className="absolute inset-0 w-full h-full opacity-40"
          viewBox="0 0 400 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M -20 640 Q 140 520 190 360 T 420 90" fill="none" stroke="#7DD3FC" strokeWidth="2" strokeDasharray="7 10" />
        </svg>

        <div
          className="w-full max-w-xs rounded-3xl p-7 text-center anim-popin relative shadow-[0_20px_45px_rgba(15,42,61,0.18)]"
          style={{ background: "rgba(255,255,255,0.92)" }}
        >
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full w-[56px] h-[56px]"
            style={{ background: "linear-gradient(135deg, #0EA5E9, #38BDF8)" }}
          >
            <Plane size={24} color="#FFFFFF" />
          </div>
          <p className="text-lg mb-1 serif text-ink font-bold">
            여행 플래너
          </p>
          <p className="text-[12px] mb-6 text-faint">
            일정을 함께 계획하고 공유해보세요
          </p>
          <button
            onClick={signIn}
            className="w-full text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 bg-white font-semibold"
            style={{ color: "#3C4043", border: "1px solid #DADCE0" }}
          >
            <GoogleIcon /> Google로 계속하기
          </button>
          <button
            onClick={signInAsDifferentAccount}
            className="w-full text-[12px] mt-3 text-faint font-bold"
          >
            다른 계정으로 로그인
          </button>
          {error && (
            <p className="text-[12px] mt-3 text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return children;
}
