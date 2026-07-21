import { useEffect, useRef } from "react";

const VARIANT_STYLES = {
  banner: { minHeight: 90, maxWidth: 728 },
  infeed: { minHeight: 140 },
  sidebar: { minHeight: 250, maxWidth: 336 },
};

const AD_CLIENT = "ca-pub-4996587777992774";

// Each variant is a genuinely different AdSense unit -- infeed is a
// fluid/native unit with its own layout key (created to match the
// results-grid card style), separate from the generic responsive
// display unit used for banner/sidebar.
const AD_UNITS = {
  banner: { format: "auto", slot: "4378563391", fullWidthResponsive: true },
  sidebar: { format: "auto", slot: "4378563391", fullWidthResponsive: true },
  infeed: { format: "fluid", slot: "2024731363", layoutKey: "-en+5m+5y-db+3i" },
};

// Ads aren't reliably filling yet (2026-07-21) -- rendering nothing
// (instead of an empty box) lets surrounding grid/list items flow into
// the space naturally. Flip back to true once AdSense is actually
// serving creative consistently.
export const ADS_ENABLED = false;

export default function AdSlot({ variant = "banner" }) {
  const dims = VARIANT_STYLES[variant] || VARIANT_STYLES.banner;
  const unit = AD_UNITS[variant] || AD_UNITS.banner;
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
        // Fluid/native units size themselves to their content -- forcing
        // height:100% here (fine for the fixed-box banner/sidebar units)
        // would fight that and can distort a fluid unit, so only the
        // display:block base style applies across all variants.
        style={{ display: "block", width: "100%" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={unit.slot}
        data-ad-format={unit.format}
        {...(unit.fullWidthResponsive ? { "data-full-width-responsive": "true" } : {})}
        {...(unit.layoutKey ? { "data-ad-layout-key": unit.layoutKey } : {})}
      />
    </div>
  );
}
