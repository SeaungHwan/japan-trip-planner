import { NextResponse } from "next/server";
import { fetchWikipediaImage } from "@/lib/wikipediaImage";
import { fetchPixabayImage } from "@/lib/pixabayImage";
import {
  extractRequestedDayCount,
  generateWithGemini,
  generateWithGroq,
  isValidSpot,
  isValidFood,
  isValidDay,
  isValidFlight,
} from "@/lib/regionAI";

// generate-region은 지역을 처음부터 새로 만들지만, 이 라우트는 이미 저장된 지역에
// 사용자가 추가 프롬프트로 요청한 편집만 반영합니다. 그래서 AI에게 "전체를 다시 써라"가
// 아니라 "요청과 관련된 것만 새로 제안해라"라고 시키고, 명소/음식/일정은 기존 값을
// 그대로 둔 채 새로 제안된 것만 뒤에 이어 붙입니다(newSpots/newFoods/newDays) —
// 기존 일정에는 개별 항목 수정/삭제 기록(day_item_edits)이 붙어있을 수 있어서, 편집
// 요청 하나로 days 전체를 덮어쓰면 그 기록들이 엉뚱한 항목을 가리키게 될 수 있습니다.
const SYSTEM_PROMPT = `당신은 일본 여행 코스를 편집하는 어시스턴트입니다.
아래에 이 지역에 대해 이미 저장된 정보와 사용자의 편집 요청이 주어집니다. 반드시 아래 JSON 형식으로만 답하세요.
설명, 코드블록 등 다른 텍스트는 절대 넣지 마세요.
{
  "jp": "지역의 일본어 이름(한자/가나) — 편집과 무관하면 기존 값 그대로",
  "lat": 33.28,
  "lng": 131.48,
  "note": "이 지역 소개 — 편집 요청이 note/전반적인 내용에 관한 것이면 반영해서 새로 쓰고, 아니면 기존 값 그대로",
  "flight": {
    "incheon": "인천국제공항 기준 항공편 상황 한 문장 — 편집과 무관하면 기존 값 그대로",
    "cheongju": "청주국제공항 기준 동일 — 편집과 무관하면 기존 값 그대로"
  },
  "newSpots": [{"name": "새로 추천하는 명소", "lat": 33.29, "lng": 131.50}],
  "newFoods": ["새로 추천하는 음식"],
  "newDays": [
    {
      "transit": {"title": "그날의 주제", "items": [{"text": "대중교통 코스 항목", "lat": 33.28, "lng": 131.48}]},
      "car": {"title": "그날의 주제", "items": [{"text": "렌트카 코스 항목", "lat": 33.30, "lng": 131.46}]}
    }
  ]
}
newSpots/newFoods/newDays는 기존 목록에 이미 있는 항목과 절대 겹치지 않는, 편집 요청으로 "새로" 추가되는 항목만 담습니다.
사용자가 명소나 음식을 요청하지 않았으면 newSpots/newFoods는 빈 배열([])로 두세요. 개수를 지정했으면 그 개수만큼만 작성하세요.
newSpots의 각 항목은 실제로 존재하는 명소를 한국어 이름과 실제 위경도(십진수)로 작성하세요.
newFoods는 실제 대표 향토음식/특산물 이름만 한국어로 작성하세요(위치 정보 불필요).
flight는 항공사명·운항 횟수·소요시간을 확실히 알 때만 구체적으로 쓰고, 조금이라도 불확실하면 반드시
"정기 직항 없음" 또는 "확인 필요"라고 답하세요. 항공사명이나 편수를 지어내지 마세요.
newDays는 기존 일정 "뒤에 새로 이어 붙일" 날짜만 작성합니다 — 기존 일정 내용을 다시 쓰거나 포함하지 마세요.
사용자가 일정 추가를 요청하지 않았으면 newDays는 반드시 빈 배열([])로 두세요. 요청했다면 정확히 지정된 일수만큼만 작성하세요.
각 day는 "transit"(대중교통)과 "car"(렌트카) 두 코스를 모두 포함하며, title은 그날의 테마만 간단히 쓰고
"1일차", "Day 1" 같은 날짜 번호/순번은 절대 붙이지 마세요. items는 2~4개의 구체적인 실제 장소/활동명과 실제 위경도(십진수)입니다.
모든 lat/lng는 실제로 알고 있는 좌표를 최대한 정확히 쓰고, 확실하지 않으면 해당 장소가 속한 동네/구역의 대략적인 중심 좌표라도 반드시 채우세요.`;

function buildUserMessage({ name, jp, note, lat, lng, flight, existingSpots, existingFoods, existingDayCount }, prompt, dayCount) {
  const context = { jp, note, lat, lng, flight, existingSpots, existingFoods, existingDayCount };
  const dayInstruction =
    dayCount > 0
      ? `newDays는 정확히 ${dayCount}일치의 새 일정을 작성하세요(기존 ${existingDayCount}일 일정 뒤에 이어질 내용입니다).`
      : "사용자가 일정 추가를 요청하지 않았으므로 newDays는 빈 배열로 두세요.";
  return `지역: ${name}\n현재 저장된 정보: ${JSON.stringify(context)}\n\n사용자의 편집 요청: ${prompt}\n\n${dayInstruction}`;
}

export async function POST(req) {
  const body = await req.json();
  const name = (body.name || "").trim();
  const prompt = (body.prompt || "").trim();
  if (!name || !prompt) {
    return NextResponse.json({ error: "편집 요청 내용을 입력해주세요" }, { status: 400 });
  }

  const existingSpots = (body.spots || []).map((s) => (typeof s === "string" ? s : s.name));
  const existingFoods = (body.foods || []).map((f) => (typeof f === "string" ? f : f.name));
  const existingDayCount = Array.isArray(body.days) ? body.days.length : 0;
  const context = {
    name,
    jp: body.jp || "",
    note: body.note || "",
    lat: body.lat,
    lng: body.lng,
    flight: body.flight || null,
    existingSpots,
    existingFoods,
    existingDayCount,
  };
  const dayCount = extractRequestedDayCount(prompt, 0);
  const userMessage = buildUserMessage(context, prompt, dayCount);

  for (const generate of [generateWithGemini, generateWithGroq]) {
    try {
      const result = await generate(SYSTEM_PROMPT, userMessage);
      const newDays = dayCount > 0 && Array.isArray(result.newDays) ? result.newDays.filter(isValidDay) : [];
      const newSpots = Array.isArray(result.newSpots) ? result.newSpots.filter(isValidSpot) : [];
      const newFoodNames = Array.isArray(result.newFoods)
        ? result.newFoods.filter(isValidFood).map((f) => f.trim())
        : [];

      if (
        typeof result.jp === "string" &&
        typeof result.note === "string" &&
        typeof result.lat === "number" &&
        typeof result.lng === "number" &&
        (dayCount === 0 || newDays.length >= dayCount)
      ) {
        // 편집 요청이 새로 추천한 명소/음식과 기존 목록이 겹치면(AI가 지시를 못 지켰거나
        // 사용자가 이미 있는 걸 다시 요청한 경우) 중복 저장되지 않도록 걸러냅니다.
        const existingSpotNames = new Set(existingSpots.map((s) => s.trim()));
        const existingFoodNames = new Set(existingFoods.map((f) => f.trim()));
        const spots = newSpots.filter((s) => !existingSpotNames.has(s.name.trim()));
        const foodNames = newFoodNames.filter((f) => !existingFoodNames.has(f));

        const foods = await Promise.all(
          foodNames.map(async (foodName) => {
            const url =
              (await fetchWikipediaImage(`${name} ${foodName}`, foodName.split(/\s+/))) ||
              (await fetchPixabayImage(foodName));
            return url ? { name: foodName, imageUrl: url } : { name: foodName };
          })
        );

        return NextResponse.json({
          jp: result.jp,
          note: result.note,
          lat: result.lat,
          lng: result.lng,
          flight: isValidFlight(result.flight) ? result.flight : null,
          newSpots: spots,
          newFoods: foods,
          newDays: newDays.slice(0, dayCount),
        });
      }
    } catch {
      // 다음 제공자로 넘어감
    }
  }

  return NextResponse.json({ error: "AI 편집에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 502 });
}
