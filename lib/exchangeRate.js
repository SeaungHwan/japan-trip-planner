// 헤더의 환율 배지와 정산 모달이 같은 통화 목록/순서/표시 단위를 쓰도록 한 곳에 모읍니다.
// unit은 환율을 몇 단위 기준으로 보여줄지입니다 — 1엔/1동은 원화로 1원도 안 돼서
// 숫자가 의미 있게 보이도록(예: 100엔=891원) 통화 가치에 맞는 단위를 씁니다.
export const CURRENCIES = [
  { code: "USD", label: "달러", unit: 1 },
  { code: "JPY", label: "엔화", unit: 100 },
  { code: "CNY", label: "위안", unit: 1 },
  { code: "VND", label: "동", unit: 100 },
];

// 헤더의 환율 배지와 정산 모달이 같은 환율을 쓰므로, 세션 동안(탭 새로고침 전까지)
// 한 번만 요청하고 그 프로미스를 공유합니다(WeatherBadge의 캐싱과 같은 이유).
let exchangeRatePromise = null;

export function getExchangeRate() {
  if (!exchangeRatePromise) {
    exchangeRatePromise = fetch("/api/exchange-rate")
      .then((res) => res.json())
      .then((data) => (data.error ? null : data))
      .catch(() => null);
  }
  return exchangeRatePromise;
}
