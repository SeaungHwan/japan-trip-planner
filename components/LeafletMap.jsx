"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, AttributionControl, useMap, useMapEvents } from "react-leaflet";
import { Minimize2 } from "lucide-react";
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

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [center[0], center[1], zoom]);
  return null;
}

// 일정 하루치 위치가 여러 개라 하나의 center/zoom으로는 다 안 보일 수 있어서,
// 그 지점들이 전부 화면에 들어오게 지도를 맞춥니다.
function FitRoute({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length < 2) return;
    map.flyToBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [48, 48], duration: 0.6 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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

export default function LeafletMap({ regions, active, zoomed, onSelect, onZoomOut, focus, route }) {
  const activeRegion = regions[active] || null;
  const [openSpot, setOpenSpot] = useState(null);

  useEffect(() => {
    setOpenSpot(null);
  }, [active, zoomed]);

  const hasCoords = !!activeRegion && typeof activeRegion.lat === "number" && typeof activeRegion.lng === "number";
  const hasFocus = zoomed && focus && typeof focus.lat === "number" && typeof focus.lng === "number";
  const hasRoute = zoomed && Array.isArray(route) && route.length > 0;
  const center = hasFocus
    ? [focus.lat, focus.lng]
    : hasRoute
    ? [route[0].lat, route[0].lng]
    : zoomed && hasCoords
    ? [activeRegion.lat, activeRegion.lng]
    : JAPAN_CENTER;
  const zoom = hasFocus || hasRoute ? FOCUS_ZOOM : zoomed && hasCoords ? REGION_ZOOM : JAPAN_ZOOM;

  const [currentZoom, setCurrentZoom] = useState(zoom);
  const scaleClass = badgeScale(currentZoom);

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
        {hasRoute && <FitRoute points={route} />}

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

        {hasRoute && (
          <>
            <Polyline
              key={`route-${route.length}`}
              positions={route.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: "#EF4444", weight: 3, opacity: 0.8, dashArray: "6 6" }}
            />
            {route.map((p, i) => (
              <Marker key={`route-${i}-${scaleClass}`} position={[p.lat, p.lng]} icon={pinIcon(13, "#EF4444")}>
                <Tooltip permanent direction="top" offset={[0, -8]} className={`spot-tooltip ${scaleClass}`}>
                  {i + 1}. {p.name}
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

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
    </div>
  );
}
