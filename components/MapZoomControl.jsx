"use client";

import { useMap } from "react-leaflet";
import { Plus, Minus } from "lucide-react";

// Leaflet 기본 확대/축소 버튼은 텍스트 "+"/"−" 글리치를 그리는 방식이라 브라우저·해상도에
// 따라 흐릿하거나 낮은 해상도로 보일 수 있습니다. 앱 톤(하늘색, 둥근 모서리)에 맞춰
// lucide 아이콘(SVG라 항상 선명함)으로 직접 그립니다.
export default function MapZoomControl() {
  const map = useMap();
  return (
    <div
      className="absolute top-2 right-2 z-[1000] flex flex-col rounded-lg overflow-hidden border border-sky-border bg-white shadow-[0_1px_3px_rgba(0,0,0,.15)]"
    >
      <button
        onClick={() => map.zoomIn()}
        aria-label="확대"
        className="flex items-center justify-center w-[35px] h-[35px] text-sky border-b border-sky-border"
      >
        <Plus size={18} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        aria-label="축소"
        className="flex items-center justify-center w-[35px] h-[35px] text-sky"
      >
        <Minus size={18} />
      </button>
    </div>
  );
}
