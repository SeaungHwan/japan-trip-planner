"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { getExchangeRate, CURRENCIES } from "@/lib/exchangeRate";

// WeatherBadge와 같은 자리(헤더)에 두는, 지역과 무관한 전역 환율 배지입니다. 정산
// 모달에 쓰는 환율과 같은 캐시(lib/exchangeRate)를 공유해서 따로 또 요청하지 않습니다.
// 배지 자체는 이 앱의 주 통화인 엔화를 대표로 보여주고, 클릭하면 달러/위안/동까지
// 한 번에 보여주는 팝오버가 열립니다.
export default function ExchangeRateBadge() {
  const [rates, setRates] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [calcCode, setCalcCode] = useState("JPY");
  const [calcInput, setCalcInput] = useState("");

  useEffect(() => {
    let alive = true;
    getExchangeRate().then((data) => alive && data && setRates(data.rates));
    return () => {
      alive = false;
    };
  }, []);

  if (!rates) return null;

  const calcRate = rates[calcCode] || 0;

  return (
    <div className="relative">
      <button onClick={() => setShowDetail((v) => !v)} aria-label="환율" className="flex items-center text-sky font-bold">
        <ArrowLeftRight size={12} />
      </button>
      {showDetail && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-lg p-3 text-[12px] bg-white border border-sky-border min-w-[200px] text-ink">
            <p className="mb-1.5 font-bold">환율</p>
            <ul className="flex flex-col gap-1 mb-2">
              {CURRENCIES.map((c) => (
                <li key={c.code} className="flex items-center justify-between text-muted">
                  <span>{c.unit} {c.code} ({c.label})</span>
                  <span className="font-bold text-ink">
                    {Math.round((rates[c.code] || 0) * c.unit).toLocaleString()}원
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-border">
              <select
                value={calcCode}
                onChange={(e) => setCalcCode(e.target.value)}
                className="text-[12px] rounded px-1 py-1 border border-sky-border"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
                type="number"
                placeholder="금액"
                className="w-16 min-w-0 text-[12px] rounded px-1.5 py-1 border border-sky-border"
              />
              <span className="text-muted">≈</span>
              <span className="font-bold text-ink">
                {Math.round((Number(calcInput) || 0) * calcRate).toLocaleString()}원
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-faint">
              참고용 환율이에요(실제 매매기준율과 다를 수 있어요).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
