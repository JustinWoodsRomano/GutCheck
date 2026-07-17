export default function AdSlot({ variant = "banner" }) {
  const dims =
    variant === "banner"
      ? { minHeight: 90, maxWidth: 728 }
      : variant === "infeed"
      ? { minHeight: 140 }
      : { minHeight: 250, maxWidth: 336 };
  return (
    <div className={`ad-slot ad-${variant}`} style={dims}>
      <span className="ad-label">Advertisement</span>
      {/*
        Real AdSense unit goes here once approved, e.g.:
        <ins className="adsbygoogle" style={{display:"block"}}
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"
             data-ad-format="auto" data-full-width-responsive="true" />
      */}
    </div>
  );
}
