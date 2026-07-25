import { NextResponse } from "next/server";

// 무료 Open-Meteo 기상 아카이브를 씁니다(API 키 불필요). 여행 날짜가 몇 달~몇 년 뒤라
// 실제 예보(보통 16일 이내만 가능)를 줄 수 없으니, 최근 몇 년간 같은 날짜(월-일)의
// 과거 실측치를 평균 내어 "대략적인" 날씨로 보여줍니다.
const YEARS_BACK = 3;

async function fetchYear(lat, lng, year, monthDay1, monthDay2) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${year}-${monthDay1}&end_date=${year}-${monthDay2}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FTokyo`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.daily || null;
}

export async function POST(req) {
  const { lat, lng, startDate, endDate } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number" || !startDate || !endDate) {
    return NextResponse.json({ error: "위치와 여행 날짜가 필요해요" }, { status: 400 });
  }

  const monthDay1 = startDate.slice(5);
  const monthDay2 = endDate.slice(5);
  if (monthDay2 < monthDay1) {
    return NextResponse.json({ error: "해를 넘기는 일정은 아직 지원하지 않아요" }, { status: 400 });
  }

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_BACK }, (_, i) => thisYear - 1 - i);

  const highs = [];
  const lows = [];
  const precs = [];

  // 연도별 조회는 서로 완전히 독립적인데 순서대로 기다리고 있어서, 응답이 3배로
  // 느려지고 있었습니다(요청당 1초 안팎 × 3년). 동시에 요청해서 가장 느린 한 건의
  // 시간만 기다리면 되게 합니다.
  const results = await Promise.all(years.map((year) => fetchYear(lat, lng, year, monthDay1, monthDay2)));
  for (const daily of results) {
    if (!daily) continue;
    (daily.temperature_2m_max || []).forEach((v) => typeof v === "number" && highs.push(v));
    (daily.temperature_2m_min || []).forEach((v) => typeof v === "number" && lows.push(v));
    (daily.precipitation_sum || []).forEach((v) => typeof v === "number" && precs.push(v));
  }

  if (highs.length === 0) {
    return NextResponse.json({ error: "날씨 정보를 가져오지 못했어요" }, { status: 502 });
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const rainyDays = precs.filter((p) => p >= 1).length;

  return NextResponse.json({
    avgHigh: Math.round(avg(highs)),
    avgLow: Math.round(avg(lows)),
    rainyChance: precs.length ? Math.round((rainyDays / precs.length) * 100) : 0,
    years,
  });
}
