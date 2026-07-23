"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Spinner from "@/components/Spinner";

const ALLOWED_DOMAIN = "klic.co.kr";

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

  if (session === undefined) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "#FFFFFF" }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,42,61,0.6)" }}>
        <div className="w-full max-w-xs rounded-2xl p-6 text-center anim-fadeup" style={{ background: "#FFFFFF" }}>
          <p className="text-base mb-5" style={{ color: "#0F2A3D", fontWeight: 700 }}>
            일본 여행 플래너
          </p>
          <button
            onClick={signIn}
            className="w-full text-sm rounded-lg py-2.5 flex items-center justify-center gap-2"
            style={{ background: "#FFFFFF", color: "#3C4043", fontWeight: 600, border: "1px solid #DADCE0" }}
          >
            <GoogleIcon /> Google로 계속하기
          </button>
          {error && (
            <p className="text-[12px] mt-3" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return children;
}
