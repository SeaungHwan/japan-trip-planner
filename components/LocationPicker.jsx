"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, AttributionControl, useMap, useMapEvents } from "react-leaflet";
import { Search } from "lucide-react";
import MapZoomControl from "@/components/MapZoomControl";

const JAPAN_CENTER = [37.5, 137.5];
const SKY = "#0EA5E9";

const markerIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#EF4444;border:2px solid #FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.3)"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) });
    },
  });
  return null;
}

function FlyToPoint({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lng], 10, { duration: 0.6 });
  }, [point?.lat, point?.lng]);
  return null;
}

export default function LocationPicker({ point, onPick }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검색 실패");
      onPick({ lat: +data.lat.toFixed(5), lng: +data.lng.toFixed(5) });
    } catch (e) {
      setError(e.message);
    }
    setSearching(false);
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="장소 이름으로 검색 (예: 삿포로역)"
          className="flex-1 min-w-0 text-sm rounded px-2 py-1.5"
          style={{ border: "1px solid #BAE6FD" }}
        />
        <button
          onClick={search}
          disabled={searching}
          aria-label="검색"
          className="shrink-0 rounded px-2.5 py-1.5"
          style={{ background: SKY, opacity: searching ? 0.6 : 1 }}
        >
          <Search size={15} color="#FFFFFF" />
        </button>
      </div>
      {error && (
        <p className="text-[12px] mb-1.5" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}
      <div className="rounded overflow-hidden" style={{ height: 220, border: "1px solid #BAE6FD" }}>
        <MapContainer
          center={point ? [point.lat, point.lng] : JAPAN_CENTER}
          zoom={point ? 10 : 5}
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
          <ClickHandler onPick={onPick} />
          <FlyToPoint point={point} />
          {point && (
            <Marker
              position={[point.lat, point.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onPick({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {point && (
        <p className="text-[11px] mt-1" style={{ color: "#94A9B8" }}>
          핀을 드래그하면 위치를 미세 조정할 수 있어요
        </p>
      )}
    </div>
  );
}
