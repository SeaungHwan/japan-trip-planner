import { supabase } from "@/lib/supabaseClient";

export const ALLOWED_DOMAIN = "klic.co.kr";

export async function getIdentity() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    nickname: meta.full_name || meta.name || session.user.email || "익명",
  };
}

// 마스터 여부는 DB(admins 테이블)만 알고 있습니다. 클라이언트는 판단하지 않고
// 서버(is_master_user() 함수)에 물어봐서 답만 받습니다.
export async function checkIsMaster() {
  const { data, error } = await supabase.rpc("is_master_user");
  if (error) {
    console.error("is_master_user RPC failed:", error);
    return false;
  }
  return !!data;
}
