import { useEffect, useState } from "react";

/**
 * Hall of Shame easter egg.
 *
 * A one-off rain of 🤢 on load. Purely decorative: the container is
 * aria-hidden and pointer-events:none, so none of it reaches the
 * accessibility tree or intercepts a click, and the component returns null
 * outright when the visitor has asked their OS to reduce motion.
 *
 * The scroll-reactive fly and roach were removed. The roach markup and its
 * styles are kept (see .critter-roach in globals.css) so it can be brought
 * back without rebuilding the animation, but nothing renders it today.
 */

const DROP_COUNT = 180;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ShameCritters() {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    // Randomised once on mount so every visit looks different. Each drop
    // gets its own lane, size, delay, drift and spin; with 180 of them the
    // variation is what stops it reading as a repeating pattern.
    setDrops(
      Array.from({ length: DROP_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.6,
        duration: 3.4 + Math.random() * 3.6,
        size: 15 + Math.random() * 26,
        drift: (Math.random() - 0.5) * 90,
        spin: (Math.random() - 0.5) * 540,
      }))
    );
  }, []);

  if (drops.length === 0) return null;

  return (
    <div className="critters" aria-hidden="true">
      <div className="nausea-rain">
        {drops.map((d) => (
          <span
            key={d.id}
            className="nausea-drop"
            style={{
              left: `${d.left}%`,
              fontSize: `${d.size}px`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
              "--drift": `${d.drift}px`,
              "--spin": `${d.spin}deg`,
            }}
          >
            🤢
          </span>
        ))}
      </div>
    </div>
  );
}
