import { useState } from "react";
import { MapPinned, Phone, Globe } from "lucide-react";
import ShareButton from "./ShareButton";

export function MapEmbed({ address, lat, lon }) {
  const q = lat && lon ? `${lat},${lon}` : encodeURIComponent(address);
  const src = `https://www.google.com/maps?q=${q}&output=embed`;
  // Google's embed can take a second or two on a slow connection, and until it
  // paints, the framed area is an empty box that reads as a broken image.
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="map-embed">
      {!loaded && <MapSpinner />}
      <iframe
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Map location"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

/** Spinning plate rim with static cutlery. Shared by every embedded map. */
export function MapSpinner() {
  return (
    <div className="map-spinner-wrap" role="status" aria-live="polite">
      <svg className="map-spinner" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="map-spinner-plate" cx="24" cy="24" r="20" />
        <g className="map-spinner-cutlery">
          <path d="M19 14v8a2 2 0 0 0 2 2 2 2 0 0 0 2-2v-8" />
          <path d="M21 24v10" />
          <path d="M29 14c-1.6 0-2.5 2-2.5 5s.9 5 2.5 5" />
          <path d="M29 24v10" />
        </g>
      </svg>
      <span className="map-spinner-label">Map loading</span>
    </div>
  );
}

export function ContactRow({ address, phone, website, restaurant, shareUrl }) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return (
    <div className="contact-row">
      <a className="contact-chip" href={directionsUrl} target="_blank" rel="noopener noreferrer">
        <MapPinned size={13} /> Directions
      </a>
      {restaurant && shareUrl && <ShareButton restaurant={restaurant} url={shareUrl} />}
      {phone && (
        <a className="contact-chip" href={`tel:${phone}`}>
          <Phone size={13} /> {phone}
        </a>
      )}
      {website && (
        <a className="contact-chip" href={website} target="_blank" rel="noopener noreferrer">
          <Globe size={13} /> Website
        </a>
      )}
    </div>
  );
}

export function RestaurantLogo({ logoUrl, name, neighborhood, grade }) {
  if (!logoUrl) return null;
  // Descriptive, natural-language alt text using real page context (name +
  // neighborhood + city), not keyword-stuffed. Grade is intentionally
  // omitted from alt text -- alt text describes the IMAGE content, and a
  // pass/fail rating isn't part of what the photo depicts; it's already
  // conveyed adjacently via the Stamp component with its own accessible
  // label.
  const alt = `${name}, a restaurant in ${neighborhood}, Chicago`;
  return <img className="detail-logo" src={logoUrl} alt={alt} loading="lazy" width="56" height="56" />;
}
