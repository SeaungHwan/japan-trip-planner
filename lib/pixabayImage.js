// 위키피디아에 향토음식 문서/사진이 없을 때만 쓰는 폴백입니다. Pixabay는 lang=ko로
// 한국어 태그 검색을 지원해서 "타코야키" 같은 한국어 음식명을 그대로 넣어도 결과가
// 잘 나옵니다(무료, CC0 계열 라이선스). PIXABAY_API_KEY가 없으면 조용히 건너뜁니다.
export async function fetchPixabayImage(query) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  try {
    const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(
      query
    )}&lang=ko&image_type=photo&category=food&safesearch=true&per_page=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.hits?.[0]?.webformatURL || null;
  } catch {
    return null;
  }
}
