import { useEffect, useRef, useState } from "react";

/**
 * Hall of Shame easter eggs.
 *
 * Two effects, both deliberately cheap and both entirely decorative:
 *
 *  - A one-off rain of 🤢 on load.
 *  - A 🪰 and a 🪳 that drift around while you scroll, moving faster the
 *    faster you scroll.
 *
 * Everything is aria-hidden and pointer-events:none, so nothing here reaches
 * the accessibility tree or intercepts a click. The whole component returns
 * null when the visitor has asked their OS to reduce motion -- swarming
 * insects across the viewport is exactly the kind of thing that setting
 * exists for.
 *
 * Positions are written straight to style.transform via refs rather than
 * React state: this runs on every scroll frame, and re-rendering a component
 * 60 times a second to move two emoji would be absurd.
 */

const DROP_COUNT = 90;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ShameCritters() {
  const [enabled, setEnabled] = useState(false);
  const [drops, setDrops] = useState([]);
  const flyRef = useRef(null);
  const roachRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setEnabled(true);

    // Randomised once on mount so every visit looks different.
    setDrops(
      Array.from({ length: DROP_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.2,
        duration: 3.4 + Math.random() * 3.6,
        size: 15 + Math.random() * 26,
        drift: (Math.random() - 0.5) * 90,
        spin: (Math.random() - 0.5) * 540,
      }))
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let lastY = window.scrollY;
    let velocity = 0;
    let raf = 0;
    // Independent wander phases so the two never look synchronised.
    let flyPhase = Math.random() * 1000;
    let roachPhase = Math.random() * 1000;
    const start = performance.now();

    const onScroll = () => {
      const y = window.scrollY;
      velocity += Math.abs(y - lastY);
      lastY = y;
    };

    const tick = (now) => {
      const t = (now - start) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Scroll speed drives how fast they wander. Decays back to a lazy
      // idle drift so they keep moving when the page is still.
      velocity *= 0.9;
      const speed = 1 + Math.min(velocity / 12, 9);

      flyPhase += 0.012 * speed;
      // The roach lags -- the fly is meant to arrive first and stay busier.
      roachPhase += 0.007 * speed;

      if (flyRef.current) {
        // Layered sines at incommensurate frequencies read as erratic
        // without ever repeating exactly.
        const x = (Math.sin(flyPhase) * 0.32 + Math.sin(flyPhase * 2.7) * 0.14 + 0.5) * w;
        const y = (Math.cos(flyPhase * 1.4) * 0.3 + Math.sin(flyPhase * 0.6) * 0.16 + 0.5) * h;
        const rot = Math.sin(flyPhase * 3.1) * 26;
        flyRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
      }
      if (roachRef.current) {
        const x = (Math.cos(roachPhase * 0.9) * 0.36 + Math.sin(roachPhase * 2.2) * 0.1 + 0.5) * w;
        const y = (Math.sin(roachPhase * 1.7) * 0.33 + Math.cos(roachPhase * 0.5) * 0.12 + 0.5) * h;
        // Points roughly where it's heading.
        const rot = Math.cos(roachPhase * 1.7) * 40 + 90;
        roachRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

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
      {/* The fly enters first; the roach follows a beat later. */}
      <span ref={flyRef} className="critter critter-fly">🪰</span>
      <span ref={roachRef} className="critter critter-roach">🪳</span>
    </div>
  );
}
