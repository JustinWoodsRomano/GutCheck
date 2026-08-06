import { useEffect, useRef, useState } from "react";

/**
 * "Built with 💪 by Backspace" footer badge, matched to the one on
 * vidarlaw.com.
 *
 * The flexing-arm mark is a Lottie animation. lottie-web is ~35KB gzipped and
 * the animation JSON another ~10KB, which is a lot to spend on a footer
 * badge, so none of it is on the critical path: an IntersectionObserver
 * loads the library and the animation only once the footer actually scrolls
 * into view. Most visitors on a restaurant page never reach the footer and
 * never pay for it.
 *
 * Under prefers-reduced-motion the Lottie is skipped entirely and a static
 * 💪 stands in -- the badge still reads correctly, it just doesn't move.
 */
export default function BackspaceBadge() {
  const holderRef = useRef(null);
  const animRef = useRef(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }

    const holder = holderRef.current;
    if (!holder) return;

    let cancelled = false;

    const start = async () => {
      try {
        // Light build: no expression engine, which this animation doesn't use.
        const lottie = (await import("lottie-web/build/player/lottie_light")).default;
        if (cancelled || !holderRef.current) return;
        animRef.current = lottie.loadAnimation({
          container: holderRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: "/lottie/backspace-flex.json",
        });
      } catch {
        // Badge stays readable without it; nothing to recover.
        setReduced(true);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(holder);

    return () => {
      cancelled = true;
      io.disconnect();
      animRef.current?.destroy?.();
    };
  }, []);

  return (
    <a
      className="bbs-badge"
      href="https://www.builtbybackspace.com/"
      target="_blank"
      rel="noopener"
      aria-label="Built with care by Backspace"
    >
      <span className="bbs-built">built with</span>
      {reduced ? (
        <span className="bbs-flex-static" aria-hidden="true">
          💪
        </span>
      ) : (
        <span className="bbs-flex" ref={holderRef} aria-hidden="true" />
      )}
      <span className="bbs-by">by</span>
      <img
        className="bbs-logo"
        src="/backspace-logo.svg"
        alt="Backspace"
        width="78"
        height="40"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
