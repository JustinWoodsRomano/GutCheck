import { useState, useEffect, useRef } from "react";
import { Share2, X, Link2, Mail, MessageSquareText, Check } from "lucide-react";
import { FacebookIcon, XIcon, LinkedInIcon, WhatsAppIcon, InstagramIcon, TikTokIcon } from "./BrandIcons";
import { getShareMessage } from "../lib/share";

// Platforms with no public web share-intent URL (Instagram, TikTok) fall
// back to copy-message-to-clipboard + a "paste it in" toast, which is the
// same workaround most apps use since neither platform accepts an
// external site pushing pre-filled content into a post or DM.
const NO_INTENT_PLATFORMS = new Set(["Instagram", "TikTok"]);

export default function ShareButton({ restaurant, url }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const message = getShareMessage(restaurant);
  const shareUrl = url;

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch {
      showToast("Couldn't copy \u2014 try selecting the link manually");
    }
  }

  const items = [
    {
      label: "Copy link",
      icon: Link2,
      onClick: () => copyToClipboard(shareUrl, "Link copied!"),
    },
    {
      label: "X",
      icon: XIcon,
      onClick: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "Facebook",
      icon: FacebookIcon,
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "LinkedIn",
      icon: LinkedInIcon,
      onClick: () =>
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "WhatsApp",
      icon: WhatsAppIcon,
      onClick: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${message} ${shareUrl}`)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "Text message",
      icon: MessageSquareText,
      onClick: () => {
        window.location.href = `sms:?body=${encodeURIComponent(`${message} ${shareUrl}`)}`;
      },
    },
    {
      label: "Email",
      icon: Mail,
      onClick: () => {
        const subject = `Chicago health inspection: ${restaurant.n}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
          `${message}\n\n${shareUrl}`
        )}`;
      },
    },
    {
      label: "Instagram",
      icon: InstagramIcon,
      onClick: () => copyToClipboard(`${message} ${shareUrl}`, "Copied \u2014 paste it into Instagram"),
    },
    {
      label: "TikTok",
      icon: TikTokIcon,
      onClick: () => copyToClipboard(`${message} ${shareUrl}`, "Copied \u2014 paste it into TikTok"),
    },
  ];

  return (
    <>
      <button
        className="contact-chip share-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? "Close share menu" : "Share this page"}
      >
        <span className={`share-trigger-icon ${open ? "is-open" : ""}`}>
          <Share2 size={13} className="icon-share" />
          <X size={13} className="icon-close" />
        </span>
        Share
      </button>

      {open && (
        <div className="share-overlay" onClick={() => setOpen(false)}>
          <div
            className="share-panel"
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Share options"
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className="share-icon-btn"
                  style={{ "--i": i }}
                  onClick={() => {
                    item.onClick();
                  }}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div className="share-toast">
          <Check size={14} /> {toast}
        </div>
      )}
    </>
  );
}
