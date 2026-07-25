// 이름 그대로의 문서에는 대표 이미지가 없는 경우가 많아서(예: "시즈오카"는 없지만
// "시즈오카현"/"시즈오카 공항"에는 있음), 검색 결과 여러 개를 받아 그중 이미지가 있는
// 첫 번째(가장 관련도 높은 순서)를 씁니다. 지역 생성(generate-region)과 일정 항목별
// 사진 조회(day-photos)가 이 로직을 함께 씁니다.
//
// 검색어와 전혀 무관한 결과를 걸러내기 위해, 후보 문서 제목에 requireKeywords 중
// 하나도 안 들어있으면 버립니다 — 틀린 사진을 보여주느니 아예 안 보여주는 게 낫습니다.
// requireKeywords를 따로 안 주면 검색어 전체 단어를 기준으로 씁니다. day-photos처럼
// "지역명 + 장소명"으로 검색할 때는 지역명만으로는 관련도 판단이 느슨해서(예: "순푸성
// 공원"을 검색했는데 시즈오카를 그냥 언급만 하는 지진 관련 지도가 걸리는 경우) 반드시
// 장소명 쪽 단어만 requireKeywords로 넘겨야 합니다.
//
// 서버 프로세스가 살아있는 동안(Vercel 서버리스 함수가 재사용되는 warm 구간)은 같은
// 검색어를 다시 위키피디아에 묻지 않도록 인메모리로 캐싱합니다. 팀 여러 명이 같은
// 지역/일정을 비슷한 시간에 열어볼 때(day-photos) 특히 효과가 큽니다. 콜드 스타트가
// 나면 비워지므로 DB 캐시는 아니고, 그 정도로 충분한 보조 캐시입니다.
const cache = new Map();

export async function fetchWikipediaImage(searchQuery, requireKeywords = null) {
  const cacheKey = `${searchQuery}::${(requireKeywords || []).join(",")}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const result = await fetchWikipediaImageUncached(searchQuery, requireKeywords);
  cache.set(cacheKey, result);
  return result;
}

async function fetchWikipediaImageUncached(searchQuery, requireKeywords) {
  try {
    const url = `https://ko.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      searchQuery
    )}&gsrlimit=5&prop=pageimages&piprop=original&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    const withImages = pages.filter((p) => p.original?.source).sort((a, b) => a.index - b.index);
    const keywords = (requireKeywords || searchQuery.split(/\s+/)).filter((w) => w.length >= 2);
    const relevant = withImages.filter((p) => keywords.some((k) => p.title.includes(k)));
    return relevant[0]?.original.source || null;
  } catch {
    return null;
  }
}
