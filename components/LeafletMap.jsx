"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import { Minimize2 } from "lucide-react";

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

export default function LeafletMap({ regions, active, zoomed, onSelect, onZoomOut, focus }) {
  const activeRegion = regions[active] || null;

  const hasCoords = !!activeRegion && typeof activeRegion.lat === "number" && typeof activeRegion.lng === "number";
  const hasFocus = zoomed && focus && typeof focus.lat === "number" && typeof focus.lng === "number";
  const center = hasFocus ? [focus.lat, focus.lng] : zoomed && hasCoords ? [activeRegion.lat, activeRegion.lng] : JAPAN_CENTER;
  const zoom = hasFocus ? FOCUS_ZOOM : zoomed && hasCoords ? REGION_ZOOM : JAPAN_ZOOM;

  return (
    <div className="rounded-2xl mb-1 relative anim-fadeup overflow-hidden" style={{ height: 340, border: "1px solid #BAE6FD" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FlyTo center={center} zoom={zoom} />

        {regions
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => typeof r.lat === "number" && typeof r.lng === "number")
          .map(({ r, i }) => {
            const isActive = i === active;
            return (
              <Marker
                key={r.id}
                position={[r.lat, r.lng]}
                icon={pinIcon(isActive ? 14 : 8, isActive ? SKY : "#7C97AA")}
                eventHandlers={{ click: () => onSelect(i) }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, isActive ? -8 : -5]}
                  className={isActive ? "region-tooltip" : "region-tooltip-inactive"}
                >
                  {r.kr}
                </Tooltip>
              </Marker>
            );
          })}

        {hasFocus && (
          <Marker position={[focus.lat, focus.lng]} icon={pinIcon(16, "#EF4444")}>
            {focus.name && (
              <Tooltip permanent direction="top" offset={[0, -10]} className="spot-tooltip">
                {focus.name}
              </Tooltip>
            )}
          </Marker>
        )}

        {zoomed &&
          activeRegion &&
          (activeRegion.moreSpots || [])
            .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
            .map((s, i) => (
              <Marker key={i} position={[s.lat, s.lng]} icon={pinIcon(9, "#F59E0B")}>
                <Tooltip permanent direction="top" offset={[0, -6]} className="spot-tooltip">
                  {s.name}
                </Tooltip>
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
