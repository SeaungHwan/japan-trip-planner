"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-2xl mb-1 anim-fadeup h-[340px] bg-sky-bg border border-sky-border"
    />
  ),
});

export default function MapView(props) {
  return <LeafletMap {...props} />;
}
