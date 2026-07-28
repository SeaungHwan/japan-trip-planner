"use client";

import { useMap, useMapEvents } from "react-leaflet";

// 지도(리플렛) 줌 레벨을 부모 상태로 올려주는 용도입니다. LeafletMap(메인 지도)과
// DayDetailMap(주변 명소/일정 자세히보기 미니맵)이 똑같이 "줌에 따라 뱃지 글자
// 크기를 바꾸는" 동작을 쓰기 때문에 공용으로 뺐습니다.
//
// zoomend에서만 반영합니다. 핀치 줌은 손가락을 떼기 전까지 zoom 이벤트를 프레임마다
// 소수점 단위로 계속 쏘는데, 여기 반응해 매번 리렌더하면 (LeafletMap의 겹침 방지
// 좌표 재계산과 맞물려) 제스처 도중 경로선이 흔들려 보였습니다. 버튼 확대/축소는
// 원래도 애니메이션이 끝난 뒤 한 번만 반영되던 것이라 이렇게 맞춰도 차이가 없습니다.
export default function ZoomWatcher({ onZoom }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

// 지도를 축소할수록 뱃지가 화면(픽셀 기준)에서 너무 커 보이고, 확대할수록 너무
// 작아 보여서, 줌 구간별로 폰트 크기 클래스를 다르게 줘서 보정합니다.
export function badgeScale(zoom) {
  if (zoom <= 6) return "badge-xs";
  if (zoom <= 9) return "badge-sm";
  if (zoom <= 13) return "badge-md";
  return "badge-lg";
}
