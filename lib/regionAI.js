// generate-region(새 지역 생성)과 edit-region(기존 지역 AI 편집)이 함께 쓰는
// AI 호출/검증 로직입니다. 프롬프트 문구 자체는 두 라우트가 각자 필요에 맞게 따로
// 관리하고, 여기서는 "무료 Gemini→Groq 순서로 시도하고 JSON을 파싱하는" 뼈대와
// 결과 검증 함수만 공유합니다.

export const DEFAULT_DAY_COUNT = 5;
export const MAX_DAY_COUNT = 14;

// "5박6일", "6일", "6일간/코스/일정" 같은 표현에서 실제 일수를 뽑아냅니다. "N박M일"은
// 뒤의 M(일수)이 실제 날짜 수이므로 그걸 우선합니다. 못 찾으면 fallback을 씁니다.
export function extractRequestedDayCount(extra, fallback) {
  if (!extra) return fallback;
  const nights = extra.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (nights) return Math.min(parseInt(nights[2], 10), MAX_DAY_COUNT);
  const days = extra.match(/(\d+)\s*일(?:간|짜리|코스|일정)?/);
  if (days) return Math.min(Math.max(parseInt(days[1], 10), 1), MAX_DAY_COUNT);
  return fallback;
}

export async function generateWithGemini(systemPrompt, userMessage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini empty response");
  return JSON.parse(text);
}

export async function generateWithGroq(systemPrompt, userMessage) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("groq empty response");
  return JSON.parse(text);
}

// 위키피디아에 쓸만한 사진이 없을 때만 쓰는 대체 경로입니다. 참고: 이 글을 쓰는 시점
// 기준 Gemini 이미지 생성 모델(gemini-2.5-flash-image)은 무료 티어 할당량이 0이라
// 실제로는 항상 실패하고 조용히 이미지 없이 넘어갑니다 — 유료 결제가 붙으면 별도
// 코드 수정 없이 그대로 동작합니다.
export async function generateImageWithGemini(name) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${name}을(를) 대표하는 실사 여행 사진 같은 풍경 이미지를 생성해주세요.` }] }],
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) return null;
    return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
  } catch {
    return null;
  }
}

export function isValidSpot(spot) {
  return spot && typeof spot.name === "string" && typeof spot.lat === "number" && typeof spot.lng === "number";
}

export function isValidFood(food) {
  return typeof food === "string" && food.trim().length > 0;
}

export function isValidItem(item) {
  return item && typeof item.text === "string" && typeof item.lat === "number" && typeof item.lng === "number";
}

export function isValidCourse(course) {
  return course && typeof course.title === "string" && Array.isArray(course.items) && course.items.every(isValidItem);
}

export function isValidDay(day) {
  return day && isValidCourse(day.transit) && isValidCourse(day.car);
}

export function isValidFlight(flight) {
  return flight && typeof flight.incheon === "string" && typeof flight.cheongju === "string";
}
