"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import Modal from "@/components/Modal";
import ImageSwiper from "@/components/ImageSwiper";

const DayDetailMap = dynamic(() => import("@/components/DayDetailMap"), {
  ssr: false,
  loading: () => <div className="rounded-lg mb-3 h-[260px] bg-sky-bg border border-sky-border" />,
});

// 일정 항목별 사진은 그 날 팝업을 열 때마다 새로 조회하기엔 아까워서(위키피디아 검색
// 여러 건 + 병렬 요청) 세션 동안은 같은 지역+항목 조합을 다시 열면 재요청하지 않도록
// 캐싱합니다(WeatherBadge와 같은 패턴, 탭을 새로고침하면 비워짐).
const dayPhotosCache = new Map();

// 일정 카드의 "자세히보기"에서 여는 팝업: 그 날 항목에 맞는 실제 사진(위키피디아에서
// 항목별로 찾음) + 실제로 남긴 메모 사진을 스와이퍼로(둘 다 없으면 아예 안 보임 —
// 지역 전체의 대표 이미지는 모든 날짜에 똑같이 나와서 "그 일정 데이터"라고 보기
// 어려워 여기엔 쓰지 않습니다), 그리고 그 날 항목들을 카드보다 자세히(팝업 안에서만
// 움직이는 자체 지도 포함) 보여줍니다. "지도에서 보기"는 메인 지도를 건드리지 않고
// 이 팝업 안의 지도만 그 지점으로 이동시킵니다.
export default function DayDetailModal({ title, items, notePhotos, regionName, onClose }) {
  const [focusPoint, setFocusPoint] = useState(null);
  const [itemPhotos, setItemPhotos] = useState([]);

  // 이 모달은 자기 상태(focusPoint 등)가 바뀔 때마다 리렌더되는데, items 자체는 그때
  // 바뀌지 않으므로 items가 실제로 바뀔 때만 다시 계산합니다. itemTexts/cacheKey는
  // 아래 useEffect의 의존성으로도 쓰여서, 값이 매번 새로 만들어지면 items가 그대로여도
  // effect가 다시 도는 것처럼 보이는 걸 막아줍니다.
  const mapPoints = useMemo(
    () =>
      items
        .map((it, i) => ({ lat: it.lat, lng: it.lng, name: it.text, num: i + 1 }))
        .filter((p) => p.lat != null),
    [items]
  );
  const itemTexts = useMemo(() => items.map((it) => it.text), [items]);
  const cacheKey = useMemo(() => `${regionName}|${itemTexts.join("|")}`, [regionName, itemTexts]);

  useEffect(() => {
    let alive = true;
    setItemPhotos([]);

    const cached = dayPhotosCache.get(cacheKey);
    const request =
      cached ||
      fetch("/api/day-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionName, items: itemTexts }),
      })
        .then((res) => res.json())
        .then((data) => (Array.isArray(data.photos) ? data.photos : []))
        .catch(() => []);
    if (!cached) dayPhotosCache.set(cacheKey, request);

    request.then((photos) => {
      if (alive) setItemPhotos(photos.filter(Boolean));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const images = [...notePhotos, ...itemPhotos];

  return (
    <Modal title={title} onClose={onClose}>
      {mapPoints.length > 0 && <DayDetailMap points={mapPoints} focus={focusPoint} />}
      {images.length > 0 && (
        <div className="mb-3">
          <ImageSwiper images={images} />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-start gap-2 rounded-lg p-2.5 bg-slate-bg border border-slate-border">
            <span
              className="shrink-0 rounded-full flex items-center justify-center text-[11px] w-[20px] h-[20px] bg-sky text-white font-bold"
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-ink">
                {it.text}
              </p>
              {it.lat != null && (
                <button
                  onClick={() => setFocusPoint({ lat: it.lat, lng: it.lng })}
                  className="text-[11px] flex items-center gap-1 mt-0.5 text-sky font-bold"
                >
                  <MapPin size={11} /> 지도에서 보기
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
