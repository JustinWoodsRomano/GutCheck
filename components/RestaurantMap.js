import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GRADE_EMOJI } from "../lib/constants";

const GRADE_COLOR = { PASS: "#2E6B4F", CONDITIONAL: "#B4841D", FAIL: "#B7362F" };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Leaflet reaches for `window`/`document` the moment it's imported, so this
// component is meant to be loaded via next/dynamic with ssr:false -- it
// should never run during server rendering.
export default function RestaurantMap({ restaurants, center, zoom = 14 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // Plugin extends the same L singleton -- must load after leaflet
      // itself resolves, not in parallel.
      await import("leaflet.markercluster");

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        [center.lat, center.lng],
        zoom
      );
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const clusterGroup = L.markerClusterGroup({ maxClusterRadius: 55 });

      restaurants.forEach((r) => {
        if (r.lat == null || r.lon == null) return;
        const emoji = GRADE_EMOJI[r.g] || "";
        const color = GRADE_COLOR[r.g] || "#666";
        const icon = L.divIcon({
          className: "map-pin-wrapper",
          html:
            `<div class="map-pin" style="border-color:${color}">` +
            `<span class="map-pin-emoji">${emoji}</span>` +
            `<span class="map-pin-label">${escapeHtml(r.n)}</span>` +
            `</div>` +
            `<div class="map-pin-arrow" style="border-top-color:${color}"></div>`,
          iconSize: null,
          iconAnchor: [22, 48],
        });
        const marker = L.marker([r.lat, r.lon], { icon });
        marker.on("click", () => router.push(`/r/${r.slug}`));
        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);

      if (center.isUser) {
        L.circleMarker([center.lat, center.lng], {
          radius: 8,
          color: "#1b3a5c",
          fillColor: "#3b6ea5",
          fillOpacity: 0.9,
          weight: 3,
        }).addTo(map);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, center.lat, center.lng, zoom]);

  return <div ref={containerRef} className="restaurant-map" />;
}
