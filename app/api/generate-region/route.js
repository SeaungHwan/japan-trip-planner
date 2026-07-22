import { NextResponse } from "next/server";

// 무료 AI 두 곳을 순서대로 시도합니다: Gemini가 되면 그걸 쓰고,
// 실패(키 없음·요청 제한·오류)하면 Groq로 자동 전환합니다.
const SYSTEM_PROMPT = `당신은 일본 여행 코스를 설계하는 어시스턴트입니다.
사용자가 준 일본 지역 이름을 보고 아래 JSON 형식으로만 답하세요. 설명, 코드블록 등 다른 텍스트는 절대 넣지 마세요.
{
  "lat": 33.28,
  "lng": 131.48,
  "spots": ["명소1", "명소2", "명소3", "명소4"],
  "note": "이 지역을 추천하는 이유나 참고할 점을 1~2문장으로",
  "days": [
    {"transit": {"title": "1일차 제목", "items": ["대중교통 코스 항목1", "항목2", "항목3"]}, "car": {"title": "1일차 제목", "items": ["렌트카 코스 항목1", "항목2"]}}
  ]
}
lat/lng는 해당 지역 중심의 실제 위경도(십진수)입니다.
spots는 실제로 존재하는 명소 이름 4개를 한국어로 작성하세요.
note는 한국어로 간결하게 작성하세요.
days는 정확히 5개를 채우고, 각 day는 "transit"(대중교통)과 "car"(렌트카) 두 코스를 모두 포함하며, title은 그날의 주제, items는 2~4개의 구체적인 실제 장소/활동명입니다. 5일 전체가 자연스러운 여행 동선이 되도록 구성하세요.`;

async function generateWithGemini(name) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n지역: ${name}` }] }],
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

async function generateWithGroq(name) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `지역: ${name}` },
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

function isValidCourse(course) {
  return course && typeof course.title === "string" && Array.isArray(course.items) && course.items.every((i) => typeof i === "string");
}

function isValidDay(day) {
  return day && isValidCourse(day.transit) && isValidCourse(day.car);
}

export async function POST(req) {
  const { name } = await req.json();
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "지역 이름을 입력해주세요" }, { status: 400 });
  }

  for (const generate of [generateWithGemini, generateWithGroq]) {
    try {
      const result = await generate(trimmed);
      const days = Array.isArray(result.days) ? result.days.filter(isValidDay) : [];
      if (
        Array.isArray(result.spots) &&
        typeof result.note === "string" &&
        typeof result.lat === "number" &&
        typeof result.lng === "number" &&
        days.length >= 5
      ) {
        return NextResponse.json({
          spots: result.spots.filter((s) => typeof s === "string"),
          note: result.note,
          lat: result.lat,
          lng: result.lng,
          days,
        });
      }
    } catch {
      // 다음 제공자로 넘어감
    }
  }

  return NextResponse.json({ error: "AI 생성에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 502 });
}
