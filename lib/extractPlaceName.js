// AI가 생성한 일정 항목은 "장소명 + 활동" 형태입니다(예: "순푸성 공원 산책",
// "시즈오카역 도착"). 활동을 뜻하는 마지막 단어까지 그대로 검색하면 위키피디아
// 검색이 엉뚱한 결과를 주기 쉬워서, 흔한 활동 단어로 끝나면 그 단어만 잘라내고
// 장소명만 남깁니다. 목록에 없는 표현이면(이미 장소명만 있는 경우 포함) 그대로 둡니다.
const ACTION_WORDS = new Set([
  "도착", "출발", "이동", "산책", "관람", "체험", "탑승", "방문", "식사", "쇼핑",
  "온천", "탐방", "여행", "관광", "휴식", "감상", "즐기기", "만끽", "구경", "투어",
  "숙박", "체크인", "체크아웃", "픽업", "반납", "하차", "승차", "입장", "관찰",
]);

export function extractPlaceName(text) {
  const trimmed = (text || "").trim();
  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= 1) return trimmed;
  const last = tokens[tokens.length - 1];
  return ACTION_WORDS.has(last) ? tokens.slice(0, -1).join(" ") : trimmed;
}
