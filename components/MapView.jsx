"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-2xl mb-1 anim-fadeup"
      style={{ height: 340, background: "#F0F9FF", border: "1px solid #BAE6FD" }}
    />
  ),
});

export default function MapView(props) {
  return <LeafletMap {...props} />;
}
