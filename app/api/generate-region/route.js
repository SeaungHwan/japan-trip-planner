import { NextResponse } from "next/server";

// 무료 AI 두 곳을 순서대로 시도합니다: Gemini가 되면 그걸 쓰고,
// 실패(키 없음·요청 제한·오류)하면 Groq로 자동 전환합니다.
const SYSTEM_PROMPT = `당신은 일본 여행 정보를 정리하는 어시스턴트입니다.
사용자가 준 일본 지역 이름을 보고 아래 JSON 형식으로만 답하세요. 설명, 코드블록 등 다른 텍스트는 절대 넣지 마세요.
{"spots": ["명소1", "명소2", "명소3", "명소4"], "note": "이 지역을 추천하는 이유나 참고할 점을 1~2문장으로"}
spots는 실제로 존재하는 명소 이름 4개를 한국어로, note는 한국어로 간결하게 작성하세요.`;

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

export async function POST(req) {
  const { name } = await req.json();
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "지역 이름을 입력해주세요" }, { status: 400 });
  }

  for (const generate of [generateWithGemini, generateWithGroq]) {
    try {
      const result = await generate(trimmed);
      if (Array.isArray(result.spots) && typeof result.note === "string") {
        return NextResponse.json({ spots: result.spots.filter((s) => typeof s === "string"), note: result.note });
      }
    } catch {
      // 다음 제공자로 넘어감
    }
  }

  return NextResponse.json({ error: "AI 생성에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 502 });
}
