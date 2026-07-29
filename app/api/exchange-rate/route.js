import { NextResponse } from "next/server";

// open.er-api.com(exchangerate-api.com 무료 티어, 키 불필요)에서 원화 기준 환율을
// 한 번에 받아옵니다. 응답은 "1원 = 몇 X"라서, 우리가 필요한 "1X = 몇 원"으로
// 뒤집습니다. 여러 통화를 한 번의 요청으로 다 받을 수 있어서(Frankfurter는 ECB
// 기준이라 베트남 동(VND)을 지원하지 않음) 이 API를 씁니다.
const CODES = ["USD", "JPY", "CNY", "VND"];

let cache = null;
const CACHE_MS = 60 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/KRW");
    if (!res.ok) throw new Error("rate fetch failed");
    const data = await res.json();
    if (data.result !== "success") throw new Error("bad rate response");

    const rates = {};
    for (const code of CODES) {
      const krwToCode = data.rates?.[code];
      if (typeof krwToCode !== "number" || krwToCode <= 0) throw new Error(`missing rate for ${code}`);
      rates[code] = 1 / krwToCode;
    }

    const result = { rates, date: data.time_last_update_utc };
    cache = { at: Date.now(), data: result };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "환율 정보를 가져오지 못했어요" }, { status: 502 });
  }
}
