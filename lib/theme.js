// tailwind.config.js의 theme.extend.colors와 값을 맞춰서 유지하는 단일 소스입니다.
// 정적인 색상은 Tailwind 클래스(text-sky, border-sky-border 등)로 옮겼지만, 상태에
// 따라 색이 바뀌는 조건부 인라인 스타일(예: isActive ? SKY : FAINT)은 클래스로
// 옮기기 어려워 그대로 남아있습니다 — 그런 곳에서도 이 상수들을 가져다 쓰면 색상 값
// 자체는 한 곳(여기 + tailwind.config.js)에서만 관리됩니다.
export const SKY = "#0EA5E9";
export const SKY_BORDER = "#BAE6FD";
export const SKY_BG = "#F0F9FF";
export const INK = "#0F2A3D";
export const MUTED = "#5B7A90";
export const FAINT = "#94A9B8";
export const DANGER = "#EF4444";
export const AMBER = "#F59E0B";
export const SLATE_BG = "#F8FAFC";
export const SLATE_BORDER = "#E2E8F0";
