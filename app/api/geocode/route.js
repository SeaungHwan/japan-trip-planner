import { NextResponse } from "next/server";

async function searchOnce(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "japan-trip-planner/1.0 (internal team trip planner)" },
  });
  if (!res.ok) return null;
  const results = await res.json();
  return results[0] || null;
}

export async function POST(req) {
  const { query } = await req.json();
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "검색어를 입력해주세요" }, { status: 400 });
  }

  // Nominatim은 "벳푸 온천"처럼 수식어가 붙은 자연어 구를 잘 못 찾을 때가 있어,
  // 뒤 단어부터 하나씩 떼어내며 재시도합니다 (예: "벳푸 온천" 실패 -> "벳푸" 성공).
  const words = trimmed.split(/\s+/);
  let first = null;
  for (let n = words.length; n >= 1 && !first; n--) {
    first = await searchOnce(words.slice(0, n).join(" "));
  }

  if (!first) {
    return NextResponse.json({ error: "검색 결과가 없어요. 더 간단한 지명으로 시도해보세요" }, { status: 404 });
  }

  return NextResponse.json({ lat: parseFloat(first.lat), lng: parseFloat(first.lon), name: first.display_name });
}
