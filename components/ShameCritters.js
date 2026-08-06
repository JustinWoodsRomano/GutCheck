import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Hall of Shame easter egg.
 *
 *  1. A rain of 🤢 on load.
 *  2. After five seconds a 🪰 rushes the screen at 3x scale, snaps to 1x,
 *     holds, then darts around on a jittery state machine.
 *  3. Tap or click it and it splatters, then stays stuck to the PAGE at the
 *     spot it died.
 *
 * That last point is the fiddly one. The live fly lives in a position:fixed
 * layer, which is right while it's flying -- it should roam the viewport, not
 * the document. But a splat parked in that layer would follow the viewport
 * forever and could never scroll out of view. So on impact the viewport
 * coordinates are converted to document coordinates (+ scrollX/scrollY) and
 * the splat is portalled into a position:absolute layer on <body>, where it
 * behaves like part of the page: scroll past it, scroll back, it's still
 * there. It survives until reload, which is as far as the brief goes -- there
 * is no persistence to storage.
 *
 * The whole thing is aria-hidden and returns null under
 * prefers-reduced-motion. The fly itself is the only element that takes
 * pointer events; everything else stays pointer-events:none so it can never
 * swallow a click meant for the page.
 *
 * The roach is still hidden -- .critter-roach styles remain in globals.css.
 */

const DROP_COUNT = 180;
const FLY_DELAY_MS = 5000;
const LANDING_HOLD_MS = 1400;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const rand = (min, max) => min + Math.random() * (max - min);


export default function ShameCritters() {
  const [drops, setDrops] = useState([]);
  const [flyVisible, setFlyVisible] = useState(false);
  const [splat, setSplat] = useState(null);
  const [swatter, setSwatter] = useState(null);
  const [swinging, setSwinging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const flyRef = useRef(null);
  // Live viewport position, kept in a ref so the click handler can read it
  // without the animation loop having to push it through React state.
  const posRef = useRef({ x: 0, y: 0, rot: 0 });
  const smashedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setMounted(true);

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

  const smash = useCallback((e) => {
    if (smashedRef.current) return;
    smashedRef.current = true;
    e.preventDefault();
    e.stopPropagation();

    const { x, y, rot } = posRef.current;
    // Viewport -> document. This is what lets the splat scroll away and come
    // back rather than riding along with the fixed layer.
    setSplat({
      x: x + window.scrollX,
      y: y + window.scrollY,
      rot,
    });
    setFlyVisible(false);
  }, []);

  // Proximity hit test. The fly is repositioned on every animation frame, so a
  // plain onPointerDown on the element almost never lands -- by the time the
  // event resolves it has darted somewhere else. Verified on desktop: the fly
  // WAS the element returned by elementFromPoint at the click coordinates and
  // the handler still did not fire. So the document decides instead -- if a
  // pointer goes down within HIT_RADIUS of wherever the fly is at that
  // instant, that counts. Nothing is preventDefault-ed unless it connects, so
  // ordinary clicks on the page are unaffected.
  useEffect(() => {
    if (!flyVisible) return;
    const HIT_RADIUS = 58;

    const onDown = (e) => {
      if (smashedRef.current) return;
      const { x, y } = posRef.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) smash(e);
    };

    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [flyVisible, smash]);

  // Swatter, shown only when the pointer is actually near the fly.
  //
  // Previously this was `cursor: url(...)` applied to <body> for as long as the
  // fly was alive, which meant the whole page had a swatter cursor whether or
  // not you were anywhere near it. It also could not animate: a CSS cursor
  // swaps between two static images with no motion in between.
  //
  // So the swatter is a real element that follows the pointer inside the
  // proximity band and hides again outside it, which both matches the intent
  // and gives the swat something to animate.
  useEffect(() => {
    if (!flyVisible || splat) {
      setSwatter(null);
      document.body.classList.remove("swatter-near");
      return;
    }
    // Comfortably wider than HIT_RADIUS so the swatter appears before you are
    // close enough to connect -- it should read as an invitation, not as a
    // hit indicator.
    const SHOW_RANGE = 150;
    let frame = 0;

    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const { x, y } = posRef.current;
        const dx = e.clientX - x;
        const dy = e.clientY - y;
        const near = Math.sqrt(dx * dx + dy * dy) <= SHOW_RANGE;
        setSwatter(near ? { x: e.clientX, y: e.clientY } : null);
        document.body.classList.toggle("swatter-near", near);
      });
    };
    const onLeave = () => {
      setSwatter(null);
      document.body.classList.remove("swatter-near");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.body.classList.remove("swatter-near");
    };
  }, [flyVisible, splat]);

  // Swing on every press, whether or not it connects -- a swing that only
  // animated on a hit would feel unresponsive on the misses.
  useEffect(() => {
    if (!flyVisible || splat) return;
    const onDown = () => {
      setSwinging(true);
      window.setTimeout(() => setSwinging(false), 320);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [flyVisible, splat]);

  useEffect(() => {
    if (!flyVisible) return;
    const el = flyRef.current;
    if (!el) return;

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    let x = rand(0.2, 0.8) * w();
    let y = rand(0.2, 0.75) * h();
    let fromX = x;
    let fromY = y;
    let toX = x;
    let toY = y;
    let rot = rand(-25, 25);
    let targetRot = rot;

    const start = performance.now();
    let phase = "landing";
    let phaseStart = start;
    let phaseDur = 420;
    let raf = 0;

    const pickTarget = () => {
      fromX = x;
      fromY = y;
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
        const scale = 3 - 2 * (p * p * p);
        el.style.opacity = String(Math.min(p * 2.2, 1));
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${scale})`;
        if (p >= 1) {
          phase = "hold";
          phaseStart = now;
          phaseDur = LANDING_HOLD_MS;
        }
      } else if (phase === "hold" || phase === "rest") {
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
          phaseDur = Math.random() < 0.3 ? rand(900, 2200) : rand(120, 700);
        }
      }

      posRef.current = { x, y, rot };
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flyVisible]);

  if (drops.length === 0) return null;

  return (
    <>
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
          <span
            ref={flyRef}
            className="critter critter-fly"
            style={{ opacity: 0 }}
            onPointerDown={smash}
          >
            🪰
          </span>
        )}
      </div>

      {/* Follows the pointer only inside the proximity band. Viewport-fixed,
          unlike the splat, because it tracks the cursor rather than the page. */}
      {mounted &&
        swatter &&
        createPortal(
          <img
            className={`swatter${swinging ? " swatter-swing" : ""}`}
            src="/swatter.png"
            alt=""
            aria-hidden="true"
            width="48"
            height="48"
            style={{ transform: `translate3d(${swatter.x}px, ${swatter.y}px, 0)` }}
          />,
          document.body
        )}

      {/* Portalled to <body> so it anchors to the document rather than the
          viewport -- see the note at the top of this file. */}
      {mounted &&
        splat &&
        createPortal(
          <div className="splat-layer" aria-hidden="true">
            <span
              className="splat"
              style={{ transform: `translate3d(${splat.x}px, ${splat.y}px, 0)` }}
            >
              {/* An image, not the 🫟 emoji. U+1FADF only shipped in Unicode
                  16 (2024), so it is absent from the system fonts on most
                  devices in use -- the glyph test was correctly falling
                  through to the squashed fly nearly everywhere, which is why
                  the splatter never actually appeared. A PNG renders the same
                  on every platform and needs no font support. */}
              <img
                className="splat-img"
                src="/splat.png"
                alt=""
                width="46"
                height="46"
                style={{ "--splat-rot": `${splat.rot}deg` }}
              />
            </span>
          </div>,
          document.body
        )}
    </>
  );
}
