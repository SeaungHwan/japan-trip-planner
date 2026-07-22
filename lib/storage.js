const STORAGE_KEY = "jp-trip-checked";

export function loadChecked() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveChecked(checked) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  } catch (e) {
    console.error("저장 실패", e);
  }
}
