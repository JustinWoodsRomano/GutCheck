import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import Stamp, { gradeAccentVar } from "./Stamp";

export default function RestaurantCard({ r, source = "unknown" }) {
  function handleClick() {
    // GA4 select_content event -- item_name + source lets us see both
    // which restaurants get clicked most and which entry point (homepage
    // grid, neighborhood page, etc.) is actually driving that traffic.
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "select_content", {
        content_type: "restaurant",
        item_id: r.slug,
        item_name: r.n,
        source,
      });
    }
  }

  return (
    <Link
      href={`/r/${r.slug}`}
      className="card"
      style={{ "--card-accent": gradeAccentVar(r.g) }}
      onClick={handleClick}
    >
      <div style={{ minWidth: 0 }}>
        <div className="card-name">{r.n}</div>
        <div className="card-meta">
          {/* Name priority: vernacular neighborhood (Bucktown, Andersonville)
              first, since it's both coordinate-accurate and how people
              actually refer to the place; then the official community area;
              then the old ZIP guess only when there are no coordinates. */}
          <MapPin size={12} /> {r.vn || r.ca || r.nb}, Chicago
        </div>
        <div className="card-meta">
          <Clock size={12} /> Last inspected {r.d}
        </div>
      </div>
      <Stamp grade={r.g} size="sm" />
    </Link>
  );
}
