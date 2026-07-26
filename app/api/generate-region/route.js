import { NextResponse } from "next/server";
import { fetchWikipediaImage } from "@/lib/wikipediaImage";

// 무료 AI 두 곳을 순서대로 시도합니다: Gemini가 되면 그걸 쓰고,
// 실패(키 없음·요청 제한·오류)하면 Groq로 자동 전환합니다.
const SYSTEM_PROMPT = `당신은 일본 여행 코스를 설계하는 어시스턴트입니다.
사용자가 준 일본 지역 이름을 보고 아래 JSON 형식으로만 답하세요. 설명, 코드블록 등 다른 텍스트는 절대 넣지 마세요.
{
  "jp": "지역의 일본어 이름(한자/가나)",
  "lat": 33.28,
  "lng": 131.48,
  "spots": [
    {"name": "명소1", "lat": 33.29, "lng": 131.50},
    {"name": "명소2", "lat": 33.27, "lng": 131.47}
  ],
  "foods": ["음식1", "음식2", "음식3"],
  "note": "이 지역을 추천하는 이유나 참고할 점을 1~2문장으로",
  "flight": {
    "incheon": "인천국제공항에서 이 지역(또는 가장 가까운 공항)까지의 항공편 상황을 한 문장으로",
    "cheongju": "청주국제공항 기준으로 동일하게 한 문장으로"
  },
  "days": [
    {
      "transit": {"title": "그날의 주제(예: 도착 & 시내 산책)", "items": [{"text": "대중교통 코스 항목1", "lat": 33.28, "lng": 131.48}, {"text": "항목2", "lat": 33.29, "lng": 131.49}]},
      "car": {"title": "그날의 주제(예: 도착 & 시내 산책)", "items": [{"text": "렌트카 코스 항목1", "lat": 33.30, "lng": 131.46}, {"text": "항목2", "lat": 33.31, "lng": 131.45}]}
    }
  ]
}
jp는 실제 지역명의 일본어 표기입니다(한자 표기가 있으면 한자로, 없으면 가나로).
lat/lng는 해당 지역 중심의 실제 위경도(십진수)입니다.
spots는 실제로 존재하는 명소 4개를 한국어 이름과 그 명소의 실제 위경도(십진수)로 작성하세요.
foods는 그 지역의 실제 대표 향토음식/특산물 이름 3~4개를 한국어로 작성하세요(위치 정보는 필요 없습니다).
note는 한국어로 간결하게 작성하세요.
flight는 항공사명·운항 횟수·소요시간을 확실히 알 때만 구체적으로 쓰고, 조금이라도 불확실하면 반드시
"정기 직항 없음" 또는 "확인 필요"라고 답하세요. 항공사명이나 편수를 지어내지 마세요.
days는 사용자 메시지에 명시된 정확한 일수만큼 채우고, 각 day는 "transit"(대중교통)과 "car"(렌트카) 두 코스를 모두 포함하며,
title은 그날의 테마만 간단히 쓰고 "1일차", "Day 1" 같은 날짜 번호/순번은 절대 붙이지 마세요(번호는 앱 화면에 이미 따로 표시됩니다).
items는 2~4개의 구체적인 실제 장소/활동명과 그 위치의 실제 위경도(십진수)입니다. 전체 일수가 자연스러운 여행 동선이 되도록 구성하세요.
모든 lat/lng는 실제로 알고 있는 좌표를 최대한 정확히 쓰고, 확실하지 않으면 해당 장소가 속한 동네/구역의 대략적인 중심 좌표라도 반드시 채우세요(비워두지 마세요).
사용자가 "추가 요청사항"을 주면 spots/note/days 구성 전체에 최대한 반영하세요(예: "아이랑 가기 좋은 곳 위주로"라면
놀이시설·체험형 명소·아이가 걷기 힘들지 않은 코스를 우선하세요). 다만 위 JSON 형식과 필드 구성은 항상 그대로 유지하세요.`;

const DEFAULT_DAY_COUNT = 5;
const MAX_DAY_COUNT = 14;

// "5박6일", "6일", "6일간/코스/일정" 같은 표현에서 실제 일수를 뽑아냅니다. "N박M일"은
// 뒤의 M(일수)이 실제 날짜 수이므로 그걸 우선합니다. 못 찾으면 기본 5일을 씁니다.
function extractRequestedDayCount(extra) {
  if (!extra) return DEFAULT_DAY_COUNT;
  const nights = extra.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (nights) return Math.min(parseInt(nights[2], 10), MAX_DAY_COUNT);
  const days = extra.match(/(\d+)\s*일(?:간|짜리|코스|일정)?/);
  if (days) return Math.min(Math.max(parseInt(days[1], 10), 1), MAX_DAY_COUNT);
  return DEFAULT_DAY_COUNT;
}

function buildUserMessage(name, extra, dayCount) {
  const base = extra ? `지역: ${name}\n추가 요청사항: ${extra}` : `지역: ${name}`;
  return `${base}\n일정(days)은 반드시 정확히 ${dayCount}일치로 작성하세요.`;
}

// 위키피디아에 쓸만한 사진이 없을 때만 쓰는 대체 경로입니다. 참고: 이 글을 쓰는 시점
// 기준 Gemini 이미지 생성 모델(gemini-2.5-flash-image)은 무료 티어 할당량이 0이라
// 실제로는 항상 실패하고 조용히 이미지 없이 넘어갑니다 — 유료 결제가 붙으면 별도
// 코드 수정 없이 그대로 동작합니다.
async function generateImageWithGemini(name) {
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

async function generateWithGemini(name, extra, dayCount) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserMessage(name, extra, dayCount)}` }] }],
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

async function generateWithGroq(name, extra, dayCount) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(name, extra, dayCount) },
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

function isValidSpot(spot) {
  return spot && typeof spot.name === "string" && typeof spot.lat === "number" && typeof spot.lng === "number";
}

function isValidFood(food) {
  return typeof food === "string" && food.trim().length > 0;
}

function isValidItem(item) {
  return item && typeof item.text === "string" && typeof item.lat === "number" && typeof item.lng === "number";
}

function isValidCourse(course) {
  return course && typeof course.title === "string" && Array.isArray(course.items) && course.items.every(isValidItem);
}

function isValidDay(day) {
  return day && isValidCourse(day.transit) && isValidCourse(day.car);
}

function isValidFlight(flight) {
  return flight && typeof flight.incheon === "string" && typeof flight.cheongju === "string";
}

export async function POST(req) {
  const { name, extra } = await req.json();
  const trimmed = (name || "").trim();
  const extraTrimmed = (extra || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "지역 이름을 입력해주세요" }, { status: 400 });
  }

  // 텍스트 생성(1~수 초)과 동시에 위키피디아 검색을 미리 보내둡니다. 텍스트 생성이
  // 끝날 때쯤엔 대부분 이미 응답이 와 있어서, 사진을 찾는다고 추가로 기다리는 시간이
  // 거의 없습니다.
  const wikiImagePromise = fetchWikipediaImage(trimmed);
  const dayCount = extractRequestedDayCount(extraTrimmed);

  for (const generate of [generateWithGemini, generateWithGroq]) {
    try {
      const result = await generate(trimmed, extraTrimmed, dayCount);
      const days = Array.isArray(result.days) ? result.days.filter(isValidDay) : [];
      const spots = Array.isArray(result.spots) ? result.spots.filter(isValidSpot) : [];
      const foods = Array.isArray(result.foods) ? result.foods.filter(isValidFood).map((f) => f.trim()) : [];
      if (
        spots.length > 0 &&
        foods.length > 0 &&
        typeof result.jp === "string" &&
        typeof result.note === "string" &&
        typeof result.lat === "number" &&
        typeof result.lng === "number" &&
        days.length >= dayCount
      ) {
        const wikiImageUrl = await wikiImagePromise;
        let image = wikiImageUrl ? { imageUrl: wikiImageUrl } : null;
        if (!image) {
          const generated = await generateImageWithGemini(trimmed);
          if (generated) image = { imageBase64: generated.base64, imageMimeType: generated.mimeType };
        }

        return NextResponse.json({
          jp: result.jp,
          spots,
          foods,
          note: result.note,
          lat: result.lat,
          lng: result.lng,
          days: days.slice(0, dayCount),
          flight: isValidFlight(result.flight) ? result.flight : null,
          ...image,
        });
      }
    } catch {
      // 다음 제공자로 넘어감
    }
  }

  return NextResponse.json({ error: "AI 생성에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 502 });
}
