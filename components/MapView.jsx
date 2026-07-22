"use client";

import { Minimize2 } from "lucide-react";
import { getIcon } from "@/data/icons";
import { MAP_IMAGE_URL } from "@/data/regions";

const SKY = "#0EA5E9";
export const ZOOM = 6;

export default function MapView({ regions, active, zoomed, onSelect, onZoomOut }) {
  const activeRegion = regions[active];
  const counter = zoomed ? 1 / ZOOM : 1;

  const transform = zoomed
    ? `scale(${ZOOM}) translate(${50 - activeRegion.x}%, ${50 - activeRegion.y}%)`
    : "scale(1) translate(0,0)";

  return (
    <div
      id="mapOuter"
      className="rounded-2xl mb-1 relative anim-fadeup"
      style={{ borderTop: "1px solid #BAE6FD", borderBottom: "1px solid #BAE6FD", animationDelay: ".05s" }}
    >
      <div id="mapInner" style={{ transform }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAP_IMAGE_URL} alt="일본 지도" draggable="false" />

        {/* Region pins */}
        <div className="absolute inset-0">
          {regions.map((r, i) => {
            const isActive = i === active;
            const Icon = getIcon(r.icon);
            const dotSize = isActive ? 14 : 8;
            return (
              <button
                key={r.id}
                className="absolute flex flex-col items-center"
                style={{ left: `${r.x}%`, top: `${r.y}%`, transform: `translate(-50%,-50%) scale(${counter})`, transformOrigin: "center" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(i);
                }}
              >
                <span
                  className={isActive ? "pin-pulse rounded-full flex items-center justify-center" : "rounded-full flex items-center justify-center"}
                  style={{ width: dotSize, height: dotSize, color: SKY }}
                >
                  <span
                    className="pin-dot rounded-full block"
                    style={{
                      width: "100%",
                      height: "100%",
                      background: isActive ? SKY : "#7C97AA",
                      border: "2px solid #FFFFFF",
                      boxShadow: "0 1px 2px rgba(0,0,0,.3)",
                    }}
                  />
                </span>
                {isActive && (
                  <span
                    className="mt-0.5 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap"
                    style={{ background: SKY, color: "#FFFFFF", fontWeight: 700 }}
                  >
                    {r.kr}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Attraction pins for the active region, real coordinates */}
        <div className="absolute inset-0">
          {zoomed &&
            (activeRegion.moreSpots || [])
              .filter((s) => typeof s.x === "number" && typeof s.y === "number")
              .map((s, i) => (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%,-50%) scale(${1 / ZOOM})`, transformOrigin: "center" }}
              >
                <span
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 9, height: 9, background: "#F59E0B", border: "2px solid #FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }}
                />
                <span
                  className="mt-0.5 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap"
                  style={{ background: "#FFFFFF", color: "#0F2A3D", border: "1px solid #F59E0B", fontWeight: 600 }}
                >
                  {s.name}
                </span>
              </div>
            ))}
        </div>
      </div>

      {zoomed && (
        <button
          className="zoom-btn absolute top-2 right-2 rounded-full px-3 py-1.5 text-xs flex items-center gap-1"
          style={{ background: "#FFFFFF", color: "#0F2A3D", border: "1px solid #BAE6FD", fontWeight: 700 }}
          onClick={onZoomOut}
        >
          <Minimize2 size={12} /> 전체 지도
        </button>
      )}
    </div>
  );
}
