"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

const JAPAN_CENTER = [37.5, 137.5];

const markerIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:10px;height:10px;border-radius:9999px;background:#EF4444;border:2px solid #FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.3)"></span>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) });
    },
  });
  return null;
}

export default function CoordsMap({ points, onPick }) {
  return (
    <div className="mb-4" style={{ height: 480 }}>
      <MapContainer center={JAPAN_CENTER} zoom={5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <ClickHandler onPick={onPick} />
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={markerIcon} />
        ))}
      </MapContainer>
    </div>
  );
}
