import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GRADE_EMOJI } from "../lib/constants";

const GRADE_COLOR = { PASS: "#2E6B4F", CONDITIONAL: "#B4841D", FAIL: "#B7362F" };

// Google Maps Platform keys are meant to be exposed client-side -- access
// is controlled server-side via API + HTTP-referrer restrictions on the
// key itself, not by hiding it. Same key already in use for Places.
const MAPS_API_KEY = "AIzaSyDY5Xph2DYWHkWNJ7S41umQXlvawLp3Ub4";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Standard Web Mercator tile-pixel projection, used only to measure
// on-screen proximity between points for clustering -- independent of
// any specific map instance's live projection object/lifecycle.
function project(lat, lng, zoom) {
  const scale = Math.pow(2, zoom);
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const x = 128 + lng * (256 / 360);
  const y = 128 + 0.5 * Math.log((1 + siny) / (1 - siny)) * (-256 / (2 * Math.PI));
  return { x: x * scale, y: y * scale };
}

// Greedy proximity clustering in screen-pixel space. O(n^2), but the map
// is always scoped to a nearby subset (rarely more than a few hundred
// points), so this stays cheap in practice.
function clusterPoints(points, zoom, pixelRadius = 48) {
  const projected = points.map((p) => ({ ...p, ...project(p.lat, p.lon, zoom) }));
  const used = new Array(projected.length).fill(false);
  const clusters = [];
  for (let i = 0; i < projected.length; i++) {
    if (used[i]) continue;
    const group = [projected[i]];
    used[i] = true;
    for (let j = i + 1; j < projected.length; j++) {
      if (used[j]) continue;
      const dx = projected[i].x - projected[j].x;
      const dy = projected[i].y - projected[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < pixelRadius) {
        group.push(projected[j]);
        used[j] = true;
      }
    }
    clusters.push(group);
  }
  return clusters;
}

let loaderPromise = null;
function loadGoogleMaps() {
  if (typeof window !== "undefined" && window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// Runs client-side only (this component is loaded via next/dynamic with
// ssr:false), so it's safe to touch window/document directly.
export default function RestaurantMap({ restaurants, center, zoom = 14 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const maps = await loadGoogleMaps();
      if (cancelled || !containerRef.current) return;

      class PinOverlay extends maps.OverlayView {
        constructor(position, html, onClick) {
          super();
          this.position = position;
          this.html = html;
          this.onClickCb = onClick;
        }
        onAdd() {
          this.div = document.createElement("div");
          this.div.style.position = "absolute";
          this.div.style.cursor = "pointer";
          this.div.innerHTML = this.html;
          this.div.addEventListener("click", (e) => {
            e.stopPropagation();
            this.onClickCb();
          });
          this.getPanes().overlayMouseTarget.appendChild(this.div);
        }
        draw() {
          const proj = this.getProjection();
          if (!proj || !this.div) return;
          const point = proj.fromLatLngToDivPixel(this.position);
          if (point) {
            this.div.style.left = point.x + "px";
            this.div.style.top = point.y + "px";
          }
        }
        onRemove() {
          if (this.div) {
            this.div.parentNode?.removeChild(this.div);
            this.div = null;
          }
        }
      }

      const map = new maps.Map(containerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        disableDefaultUI: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;

      function clearOverlays() {
        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];
      }

      function render() {
        clearOverlays();
        const currentZoom = map.getZoom();
        const groups = clusterPoints(
          restaurants.filter((r) => r.lat != null && r.lon != null),
          currentZoom
        );

        groups.forEach((group) => {
          if (group.length === 1) {
            const r = group[0];
            const emoji = GRADE_EMOJI[r.g] || "";
            const color = GRADE_COLOR[r.g] || "#666";
            const html =
              `<div class="map-pin" style="border-color:${color}">` +
              `<span class="map-pin-emoji">${emoji}</span>` +
              `<span class="map-pin-label">${escapeHtml(r.n)}</span>` +
              `</div>`;
            const overlay = new PinOverlay(new maps.LatLng(r.lat, r.lon), html, () =>
              router.push(`/r/${r.slug}`)
            );
            overlay.setMap(map);
            overlaysRef.current.push(overlay);
          } else {
            const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
            const avgLon = group.reduce((s, p) => s + p.lon, 0) / group.length;
            const bounds = new maps.LatLngBounds();
            group.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lon)));
            const html = `<div class="map-cluster">${group.length}</div>`;
            const overlay = new PinOverlay(new maps.LatLng(avgLat, avgLon), html, () =>
              map.fitBounds(bounds, 60)
            );
            overlay.setMap(map);
            overlaysRef.current.push(overlay);
          }
        });
      }

      map.addListener("idle", render);

      if (center.isUser) {
        new maps.Marker({
          position: { lat: center.lat, lng: center.lng },
          map,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b6ea5",
            fillOpacity: 0.9,
            strokeColor: "#1b3a5c",
            strokeWeight: 3,
          },
          zIndex: 999,
        });
      }
    }

    init();

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, center.lat, center.lng, zoom]);

  return <div ref={containerRef} className="restaurant-map" />;
}
