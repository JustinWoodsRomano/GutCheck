import { useEffect, useRef, useState } from "react";

/**
 * Hall of Shame easter egg.
 *
 * Two beats, staged so they don't compete:
 *
 *  1. A rain of 🤢 on load.
 *  2. Five seconds later a 🪰 lands on the glass -- rushing in at 3x scale
 *     and snapping down to 1x -- sits still for a moment, then starts
 *     darting around.
 *
 * The movement is a deliberate state machine rather than smooth easing.
 * Sine-wave drift reads as a balloon; a fly reads as *stillness punctuated by
 * sudden darts*, so it holds position, snaps to a new spot in under a fifth
 * of a second, holds again. A little per-frame jitter on top keeps it from
 * ever looking parked.
 *
 * Everything is aria-hidden and pointer-events:none, and the whole component
 * returns null under prefers-reduced-motion -- an insect twitching across the
 * viewport is exactly what that setting is for.
 *
 * The roach is currently hidden. Its styles remain in globals.css
 * (.critter-roach) so it can be reinstated without rebuilding this.
 */

const DROP_COUNT = 180;
const FLY_DELAY_MS = 5000;
// How long the fly sits still after touching down, before the first dart.
const LANDING_HOLD_MS = 1400;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const rand = (min, max) => min + Math.random() * (max - min);

export default function ShameCritters() {
  const [drops, setDrops] = useState([]);
  const [flyVisible, setFlyVisible] = useState(false);
  const flyRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

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

    const t = setTimeout(() => setFlyVisible(true), FLY_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!flyVisible) return;

    const el = flyRef.current;
    if (!el) return;

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    // Touches down somewhere in the middle band -- not against an edge,
    // where it would look like a rendering glitch rather than a fly.
    let x = rand(0.2, 0.8) * w();
    let y = rand(0.2, 0.75) * h();
    let fromX = x;
    let fromY = y;
    let toX = x;
    let toY = y;
    let rot = rand(-25, 25);
    let targetRot = rot;

    const start = performance.now();
    // "landing" -> "hold" -> alternating "dart" and "rest"
    let phase = "landing";
    let phaseStart = start;
    let phaseDur = 420;
    let raf = 0;

    const pickTarget = () => {
      fromX = x;
      fromY = y;
      // Mostly short hops with the occasional longer break for the other
      // side of the screen -- the mix is what makes it read as erratic.
      const long = Math.random() < 0.22;
      const reach = long ? rand(0.25, 0.5) : rand(0.03, 0.14);
      const angle = rand(0, Math.PI * 2);
      toX = Math.min(w() - 40, Math.max(10, x + Math.cos(angle) * reach * w()));
      toY = Math.min(h() - 40, Math.max(10, y + Math.sin(angle) * reach * h()));
      targetRot = rand(-40, 40);
      phaseDur = long ? rand(150, 260) : rand(60, 150);
    };

    const tick = (now) => {
      const elapsed = now - phaseStart;

      if (phase === "landing") {
        const p = Math.min(elapsed / phaseDur, 1);
        // Cubic ease-in: hangs large for a beat then collapses to 1x, which
        // reads as rushing at the glass rather than gently zooming out.
        const scale = 3 - 2 * (p * p * p);
        el.style.opacity = String(Math.min(p * 2.2, 1));
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${scale})`;
        if (p >= 1) {
          phase = "hold";
          phaseStart = now;
          phaseDur = LANDING_HOLD_MS;
        }
      } else if (phase === "hold" || phase === "rest") {
        // Never perfectly still -- a sub-pixel tremble sells "alive".
        const jx = rand(-0.7, 0.7);
        const jy = rand(-0.7, 0.7);
        el.style.transform = `translate3d(${x + jx}px, ${y + jy}px, 0) rotate(${rot}deg) scale(1)`;
        if (elapsed >= phaseDur) {
          pickTarget();
          phase = "dart";
          phaseStart = now;
        }
      } else if (phase === "dart") {
        const p = Math.min(elapsed / phaseDur, 1);
        // Ease-out: leaves fast, arrives soft, like an actual landing.
        const e = 1 - Math.pow(1 - p, 3);
        x = fromX + (toX - fromX) * e;
        y = fromY + (toY - fromY) * e;
        rot = rot + (targetRot - rot) * e * 0.4;
        const jx = rand(-1.6, 1.6);
        const jy = rand(-1.6, 1.6);
        el.style.transform = `translate3d(${x + jx}px, ${y + jy}px, 0) rotate(${rot}deg) scale(1)`;
        if (p >= 1) {
          x = toX;
          y = toY;
          phase = "rest";
          phaseStart = now;
          // Wildly uneven pauses. Even spacing would read as a metronome.
          phaseDur = Math.random() < 0.3 ? rand(900, 2200) : rand(120, 700);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flyVisible]);

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
      {flyVisible && (
        <span ref={flyRef} className="critter critter-fly" style={{ opacity: 0 }}>
          🪰
        </span>
      )}
    </div>
  );
}
