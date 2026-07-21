import { useEffect, useRef } from "react";

const VARIANT_STYLES = {
  banner: { minHeight: 90, maxWidth: 728 },
  infeed: { minHeight: 140 },
  sidebar: { minHeight: 250, maxWidth: 336 },
};

const AD_CLIENT = "ca-pub-4996587777992774";
const AD_SLOT = "4378563391";

// Ads aren't reliably filling yet (2026-07-21) -- rendering nothing
// (instead of an empty box) lets surrounding grid/list items flow into
// the space naturally. Flip back to true once AdSense is actually
// serving creative consistently.
const ADS_ENABLED = false;

export default function AdSlot({ variant = "banner" }) {
  const dims = VARIANT_STYLES[variant] || VARIANT_STYLES.banner;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    // Guard against double-push in dev (React 18 strict-mode double effect)
    // and on client-side route changes re-mounting the same slot.
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense script blocked (ad blocker) or not yet loaded -- fail
      // silently so a missing ad never breaks the page around it.
    }
  }, []);

  if (!ADS_ENABLED) return null;

  return (
    <div className={`ad-slot ad-${variant}`} style={dims}>
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
