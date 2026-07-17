import { MapPinned, Phone, Globe } from "lucide-react";
import ShareButton from "./ShareButton";

export function MapEmbed({ address, lat, lon }) {
  const q = lat && lon ? `${lat},${lon}` : encodeURIComponent(address);
  const src = `https://www.google.com/maps?q=${q}&output=embed`;
  return (
    <div className="map-embed">
      <iframe src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Map location" />
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

export function RestaurantLogo({ logoUrl, name }) {
  if (!logoUrl) return null;
  return <img className="detail-logo" src={logoUrl} alt={`${name} logo`} loading="lazy" />;
}
