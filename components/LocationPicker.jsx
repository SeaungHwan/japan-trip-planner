"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

const JAPAN_CENTER = [37.5, 137.5];

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

export default function LocationPicker({ point, onPick }) {
  return (
    <div className="rounded overflow-hidden mb-2" style={{ height: 220, border: "1px solid #BAE6FD" }}>
      <MapContainer
        center={point ? [point.lat, point.lng] : JAPAN_CENTER}
        zoom={point ? 10 : 5}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ClickHandler onPick={onPick} />
        {point && <Marker position={[point.lat, point.lng]} icon={markerIcon} />}
      </MapContainer>
    </div>
  );
}
