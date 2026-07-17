import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import Stamp, { gradeAccentVar } from "./Stamp";

export default function RestaurantCard({ r }) {
  return (
    <Link href={`/r/${r.slug}`} className="card" style={{ "--card-accent": gradeAccentVar(r.g) }}>
      <div style={{ minWidth: 0 }}>
        <div className="card-name">{r.n}</div>
        <div className="card-meta">
          <MapPin size={12} /> {r.nb}, Chicago
        </div>
        <div className="card-meta">
          <Clock size={12} /> Last inspected {r.d}
        </div>
      </div>
      <Stamp grade={r.g} size="sm" />
    </Link>
  );
}
