import { NextResponse } from "next/server";

// Nominatim(OpenStreetMap 지오코딩, 무료·키 불필요)으로 숙소 이름을 검색해서 주소와
// 위경도를 한 번에 받아옵니다. 서버에서 대신 요청하는 이유는 두 가지입니다: (1) Nominatim
// 사용 정책이 요청자를 식별할 수 있는 User-Agent를 요구하는데 브라우저가 보내는 기본
// UA로는 안 되고, (2) 클라이언트에서 직접 부르면 CORS로 막힙니다. 이 앱은 일본 여행
// 전용이라 countrycodes=jp로 결과를 일본으로 한정합니다.
export async function GET(req) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=jsonv2&addressdetails=0&limit=5&countrycodes=jp&accept-language=ko`;
    const res = await fetch(url, {
      headers: { "User-Agent": "japan-trip-planner (personal travel planning app)" },
    });
    if (!res.ok) throw new Error("search failed");
    const data = await res.json();
    const results = data.map((d) => ({
      name: d.name || d.display_name.split(",")[0],
      address: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
