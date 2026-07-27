import { useEffect, useRef, useState } from "react";
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
export default function RestaurantMap({ restaurants, center, zoom = 14, fitToMarkers = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const leafletRef = useRef(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // --- Effect 1: build the map itself. Deliberately does NOT depend on
  // `restaurants` -- rebuilding the whole Leaflet instance on every
  // keystroke would tear down and re-create tiles/panes each time, which
  // is both expensive and visibly flickery on mobile.
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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const clusterGroup = L.markerClusterGroup({ maxClusterRadius: 55 });
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

      leafletRef.current = L;
      mapRef.current = map;
      clusterRef.current = clusterGroup;
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      setReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      clusterRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  // --- Effect 2: sync the pins to whatever set of restaurants was passed
  // in. Runs on every search change, but only swaps marker layers -- the
  // map, its tiles and the user's location dot all stay put.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const clusterGroup = clusterRef.current;
    if (!ready || !L || !map || !clusterGroup) return;

    clusterGroup.clearLayers();

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

    if (fitToMarkers && restaurants.length > 0) {
      // Zoom/pan to the search results wherever they are -- searching for
      // a specific place shouldn't leave you staring at your own block.
      // maxZoom keeps a single result from slamming to full zoom.
      map.fitBounds(clusterGroup.getBounds(), { padding: [40, 40], maxZoom: 17 });
    } else if (!fitToMarkers) {
      // Search cleared -- return to the "near me" framing.
      map.setView([center.lat, center.lng], zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, fitToMarkers, ready]);

  return <div ref={containerRef} className="restaurant-map" />;
}
