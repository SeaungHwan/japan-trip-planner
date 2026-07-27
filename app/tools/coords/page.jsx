"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const CoordsMap = dynamic(() => import("./CoordsMap"), {
  ssr: false,
  loading: () => <div className="mb-4 h-[480px] bg-sky-bg" />,
});

const STORAGE_KEY = "coords-picker-points";

export default function CoordsPickerPage() {
  const [points, setPoints] = useState([]);
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPoints(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  }, [points, loaded]);

  function addPoint({ lat, lng }) {
    setPoints((prev) => [...prev, { name: name || `spot${prev.length + 1}`, lat, lng }]);
    setName("");
  }

  function updatePoint(i, field, value) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function removePoint(i) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
  }

  const snippet = points.map((p) => `      spot("${p.name}", ${p.lat}, ${p.lng}),`).join("\n");

  function copySnippet() {
    navigator.clipboard.writeText(snippet);
  }

  return (
    <div className="app-scroll max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-2">지도 좌표 피커</h1>
      <p className="text-sm mb-4 text-gray-600">
        이름을 입력하고 지도를 클릭하면 그 위치의 위경도가 기록됩니다. 이름을 비워두면 spot1, spot2...로 자동 채워집니다. 마커를 클릭하면 삭제되고, 표에서 값을 바로 수정할 수 있습니다.
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="다음 클릭에 붙일 이름 (예: 삿포로 시계탑)"
        className="border rounded px-2 py-1 mb-3 w-full"
      />

      <CoordsMap points={points} onPick={addPoint} onDelete={removePoint} />

      <table className="w-full text-sm mb-3 border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">이름</th>
            <th className="py-1">lat</th>
            <th className="py-1">lng</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePoint(i, "name", e.target.value)}
                  className="border rounded px-1 py-0.5 w-full"
                />
              </td>
              <td className="py-1">
                <input
                  type="number"
                  step="any"
                  value={p.lat}
                  onChange={(e) => updatePoint(i, "lat", +e.target.value)}
                  className="border rounded px-1 py-0.5 w-20"
                />
              </td>
              <td className="py-1">
                <input
                  type="number"
                  step="any"
                  value={p.lng}
                  onChange={(e) => updatePoint(i, "lng", +e.target.value)}
                  className="border rounded px-1 py-0.5 w-20"
                />
              </td>
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