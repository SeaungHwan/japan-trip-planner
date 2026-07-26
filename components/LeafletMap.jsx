"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, AttributionControl, useMap, useMapEvents } from "react-leaflet";
import { Minimize2, LayoutGrid } from "lucide-react";
import MapZoomControl from "@/components/MapZoomControl";

const SKY = "#0EA5E9";
const JAPAN_CENTER = [37.5, 137.5];
const JAPAN_ZOOM = 5;
const REGION_ZOOM = 12;
const FOCUS_ZOOM = 15;

function pinIcon(size, color) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.3)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// 일정 핀에는 몇 일차 항목인지 배지로 표시합니다(항목 이름은 툴팁으로).
function dayPinIcon(day, size, color) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;font-size:10px;font-weight:700;border:2px solid #FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.3)">${day}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [center[0], center[1], zoom]);
  return null;
}

function ZoomWatcher({ onZoom }) {
  const map = useMap();
  useMapEvents({ zoom: () => onZoom(map.getZoom()), zoomend: () => onZoom(map.getZoom()) });
  return null;
}

function badgeScale(zoom) {
  if (zoom <= 6) return "badge-xs";
  if (zoom <= 9) return "badge-sm";
  if (zoom <= 13) return "badge-md";
  return "badge-lg";
}

// 기본값은 하루에 첫 번째 위치 있는 일정만 보여줍니다(전체보기를 눌러야 그 날의 나머지도 다 나옴).
function firstPinPerDay(pins) {
  const seen = new Set();
  const result = [];
  for (const p of pins) {
    if (seen.has(p.day)) continue;
    seen.add(p.day);
    result.push(p);
  }
  return result;
}

// 같은 지점(예: 공항)에 여러 날짜의 핀이 겹치면 배지 텍스트가 서로 가려서 안 보이므로,
// 좌표가 사실상 같은 핀들을 화면 픽셀 기준으로 살짝 원형으로 벌려서 겹치지 않게 합니다.
function metersPerPixel(zoom, lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function spreadOverlappingPins(pins, zoom) {
  const groups = new Map();
  pins.forEach((p, i) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });

  const spread = pins.map((p) => ({ ...p }));
  groups.forEach((indices) => {
    if (indices.length < 2) return;
    const lat = pins[indices[0]].lat;
    const radiusMeters = 22 * metersPerPixel(zoom, lat);
    const latPerMeter = 1 / 111320;
    const lngPerMeter = 1 / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
    indices.forEach((idx, j) => {
      const angle = (2 * Math.PI * j) / indices.length;
      spread[idx].lat += radiusMeters * latPerMeter * Math.cos(angle);
      spread[idx].lng += radiusMeters * lngPerMeter * Math.sin(angle);
    });
  });
  return spread;
}

export default function LeafletMap({ regions, active, zoomed, onSelect, onZoomOut, focus, dayPins, showAllDayPins, onToggleAllDayPins }) {
  const activeRegion = regions[active] || null;
  const [openSpot, setOpenSpot] = useState(null);

  useEffect(() => {
    setOpenSpot(null);
  }, [active, zoomed]);

  const hasCoords = !!activeRegion && typeof activeRegion.lat === "number" && typeof activeRegion.lng === "number";
  const hasFocus = zoomed && focus && typeof focus.lat === "number" && typeof focus.lng === "number";
  const center = hasFocus
    ? [focus.lat, focus.lng]
    : zoomed && hasCoords
    ? [activeRegion.lat, activeRegion.lng]
    : JAPAN_CENTER;
  const zoom = hasFocus ? FOCUS_ZOOM : zoomed && hasCoords ? REGION_ZOOM : JAPAN_ZOOM;

  const [currentZoom, setCurrentZoom] = useState(zoom);
  const scaleClass = badgeScale(currentZoom);

  const validDayPins = (dayPins || []).filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const shownDayPins = showAllDayPins ? validDayPins : firstPinPerDay(validDayPins);
  const spreadDayPins = spreadOverlappingPins(shownDayPins, currentZoom);

  return (
    <div className="rounded-2xl mb-1 relative anim-fadeup overflow-hidden" style={{ height: 340, border: "1px solid #BAE6FD" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <AttributionControl position="bottomright" prefix={false} />
        <MapZoomControl />
        <FlyTo center={center} zoom={zoom} />
        <ZoomWatcher onZoom={setCurrentZoom} />

        {regions
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => typeof r.lat === "number" && typeof r.lng === "number")
          .map(({ r, i }) => {
            const isActive = i === active;
            return (
              <Marker
                key={`${r.id}-${scaleClass}`}
                position={[r.lat, r.lng]}
                icon={pinIcon(isActive ? 14 : 8, isActive ? SKY : "#7C97AA")}
                eventHandlers={{ click: () => onSelect(i) }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]} className={`region-tooltip ${scaleClass}`}>
                  {r.kr}
                </Tooltip>
              </Marker>
            );
          })}

        {hasFocus && (
          <Marker key={`focus-${scaleClass}`} position={[focus.lat, focus.lng]} icon={pinIcon(16, "#EF4444")}>
            {focus.name && (
              <Tooltip permanent direction="top" offset={[0, -10]} className={`spot-tooltip ${scaleClass}`}>
                {focus.name}
              </Tooltip>
            )}
          </Marker>
        )}

        {zoomed &&
          activeRegion &&
          spreadDayPins.map((p, i) => (
            <Marker key={`day-${i}-${scaleClass}`} position={[p.lat, p.lng]} icon={dayPinIcon(p.day, 16, "#EF4444")}>
              <Tooltip permanent direction="top" offset={[0, -8]} className={`spot-tooltip ${scaleClass}`}>
                {p.day}일차 · {p.name}
              </Tooltip>
            </Marker>
          ))}

        {zoomed &&
          activeRegion &&
          (activeRegion.moreSpots || [])
            .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
            .map((s, i) => (
              <Marker
                key={`${i}-${scaleClass}`}
                position={[s.lat, s.lng]}
                icon={pinIcon(9, "#F59E0B")}
                eventHandlers={{ click: () => setOpenSpot((prev) => (prev === i ? null : i)) }}
              >
                {openSpot === i && (
                  <Tooltip permanent direction="top" offset={[0, -6]} className={`spot-tooltip ${scaleClass}`}>
                    {s.name}
                  </Tooltip>
                )}
              </Marker>
            ))}
      </MapContainer>

      {zoomed && (
        <button
          className="zoom-btn absolute top-2 right-2 z-[1000] rounded-full px-3 py-1.5 text-xs flex items-center gap-1"
          style={{ background: "#FFFFFF", color: "#0F2A3D", border: "1px solid #BAE6FD", fontWeight: 700 }}
          onClick={onZoomOut}
        >
          <Minimize2 size={12} /> 전체 지도
        </button>
      )}

      {zoomed && activeRegion && validDayPins.length > 0 && (
        <button
          className="zoom-btn absolute top-11 right-2 z-[1000] rounded-full px-3 py-1.5 text-xs flex items-center gap-1"
          style={{ background: showAllDayPins ? SKY : "#FFFFFF", color: showAllDayPins ? "#FFFFFF" : "#0F2A3D", border: "1px solid #BAE6FD", fontWeight: 700 }}
          onClick={onToggleAllDayPins}
        >
          <LayoutGrid size={12} /> 전체보기
        </button>
      )}
    </div>
  );
}
