import { NextResponse } from "next/server";
import { fetchWikipediaImage } from "@/lib/wikipediaImage";
import { extractPlaceName } from "@/lib/extractPlaceName";

// 일정 자세히보기 팝업에서, 지역 전체의 대표 사진(모든 날짜에 똑같이 나옴) 대신
// 그 날 항목 각각(예: "순푸성 공원 산책")에 맞는 실제 사진을 위키피디아에서 찾습니다.
// "산책"/"도착" 같은 활동 단어는 검색어에서 빼고(extractPlaceName) 지역 이름을 앞에
// 붙여서 같은 이름의 다른 지역과 헷갈리지 않게 합니다. 항목이 여러 개라 요청도 여러
// 번 나가는데, 서로 완전히 독립적이라 병렬로 보냅니다.
export async function POST(req) {
  const { regionName, items } = await req.json();
  const list = Array.isArray(items) ? items.map((s) => (s || "").trim()).filter(Boolean) : [];
  if (list.length === 0) {
    return NextResponse.json({ photos: [] });
  }

  const name = (regionName || "").trim();
  const photos = await Promise.all(
    list.map((item) => {
      const place = extractPlaceName(item);
      const query = name ? `${name} ${place}` : place;
      // 관련도 판단은 지역명이 아니라 장소명 쪽 단어로만 합니다 — 지역명만 일치해도
      // 통과시키면 그 지역을 그냥 언급하는 무관한 문서(지리/역사 등)가 걸릴 수 있습니다.
      return fetchWikipediaImage(query, place.split(/\s+/));
    })
  );

  return NextResponse.json({ photos });
}
