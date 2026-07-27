"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, AttributionControl, useMap } from "react-leaflet";
import MapZoomControl from "@/components/MapZoomControl";
import { SKY } from "@/lib/theme";

function numberIcon(n) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${SKY};color:#fff;font-size:11px;font-weight:700;border:2px solid #FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.3)">${n}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// focus가 있으면 그 지점으로, 없으면 모든 지점이 다 보이게 맞춥니다. 메인 지도와는
// 별개의 독립된 MapContainer라 여기서 움직여도 메인 지도 상태에는 영향이 없습니다.
function FitOrFocus({ points, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], 15, { duration: 0.5 });
    } else if (points.length > 1) {
      // 이 지도를 담은 모달을 fitBounds의 줌 전환 애니메이션이 끝나기 전에 닫으면,
      // 리플렛이 CSS transitionend 콜백에서 이미 언마운트로 사라진 지도 팬(pane)을
      // 참조해 "Cannot read properties of undefined (reading '_leaflet_pos')" 에러가
      // 났습니다. 애초에 애니메이션 없이 즉시 맞추면 이 문제가 안 생깁니다(팝업 안
      // 작은 지도라 애니메이션이 없어도 눈에 띄는 차이는 없습니다). map.stop()으로
      // 언마운트 시점에 취소하는 방법도 시도했지만, 그 cleanup 자체가 리플렛이 지도
      // 팬을 이미 정리한 뒤에 실행돼 같은 종류의 에러를 냈습니다 — 언마운트 정리는
      // react-leaflet의 MapContainer가 이미 담당하므로 여기서 손대지 않습니다.
      map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [30, 30], animate: false });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lng, points.length]);
  return null;
}

// 일정 자세히보기 팝업 안에서만 쓰는 작은 지도입니다. 항목 번호는 목록의 번호와
// 맞도록 points에 미리 매겨서 넘겨받습니다(좌표 없는 항목은 걸러진 뒤라 번호가
// 건너뛸 수 있음).
export default function DayDetailMap({ points, focus }) {
  if (points.length === 0) return null;
  const center = [points[0].lat, points[0].lng];

  return (
    <div className="rounded-lg overflow-hidden mb-3 relative h-[260px] border border-sky-border">
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <AttributionControl position="bottomright" prefix={false} />
        <MapZoomControl />
        <FitOrFocus points={points} focus={focus} />
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#EF4444", weight: 3, opacity: 0.8, dashArray: "6 6" }}
          />
        )}
        {points.map((p) => (
          <Marker key={p.num} position={[p.lat, p.lng]} icon={numberIcon(p.num)}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="spot-tooltip">
              {p.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
