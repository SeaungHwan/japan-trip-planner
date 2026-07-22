const KEY = "jp-trip-nickname";

export function getNickname() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

export function ensureNickname() {
  if (typeof window === "undefined") return "";
  let nick = getNickname();
  if (!nick) {
    nick = (window.prompt("닉네임을 입력해주세요 (댓글·투표에 표시돼요)") || "").trim();
    if (nick) window.localStorage.setItem(KEY, nick);
  }
  return nick;
}
