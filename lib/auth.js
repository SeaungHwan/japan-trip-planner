import { supabase } from "@/lib/supabaseClient";

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
