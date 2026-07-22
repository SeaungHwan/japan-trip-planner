"use client";

import { useRef, useState } from "react";
import { MAP_IMAGE_URL } from "@/data/regions";

export default function CoordsPickerPage() {
  const imgRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [name, setName] = useState("");

  function handleClick(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPoints((prev) => [...prev, { name: name || `spot${prev.length + 1}`, x: +x.toFixed(2), y: +y.toFixed(2) }]);
    setName("");
  }

  function removePoint(i) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
  }

  const snippet = points.map((p) => `      { name: "${p.name}", x: ${p.x}, y: ${p.y} },`).join("\n");

  function copySnippet() {
    navigator.clipboard.writeText(snippet);
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-2">지도 좌표 피커</h1>
      <p className="text-sm mb-4 text-gray-600">
        이름을 입력하고 지도를 클릭하면 그 위치의 x/y %가 기록됩니다. 이름을 비워두면 spot1, spot2...로 자동 채워집니다.
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="다음 클릭에 붙일 이름 (예: 삿포로 시계탑)"
        className="border rounded px-2 py-1 mb-3 w-full"
      />

      <div className="relative select-none mb-4" style={{ cursor: "crosshair" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={MAP_IMAGE_URL} alt="일본 지도" draggable="false" onClick={handleClick} className="w-full block" />
        {points.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 8,
              height: 8,
              background: "#EF4444",
              border: "2px solid #fff",
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>

      <table className="w-full text-sm mb-3 border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">이름</th>
            <th className="py-1">x%</th>
            <th className="py-1">y%</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="py-1">{p.x}</td>
              <td className="py-1">{p.y}</td>
              <td className="py-1">
                <button onClick={() => removePoint(i)} className="text-red-500">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <textarea readOnly value={snippet} rows={Math.max(3, points.length)} className="w-full border rounded p-2 text-xs font-mono mb-2" />
      <button onClick={copySnippet} className="border rounded px-3 py-1.5 bg-black text-white text-sm">
        코드 복사
      </button>
    </div>
  );
}
