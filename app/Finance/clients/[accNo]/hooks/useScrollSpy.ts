"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// rootMargin: shrinks the scroll container by 20% at the top and 70% at the
// bottom, leaving a thin detection band at roughly 20–30% from the top.
// Percentages are relative to the root element's bounding rect (not the
// viewport), because we pass <main> as the root so the observer fires
// reliably on scrolls within that container rather than on window scrolls.
const SCROLLSPY_MARGIN = "-20% 0px -70% 0px";

// Smooth-scroll animations typically finish within ~600 ms; 800 ms gives a
// safe margin before we release the programmatic-scroll lock.
const SCROLL_LOCK_MS = 800;

export function useScrollSpy(
  sectionIds: readonly string[],
  // The element that actually scrolls (<main>), passed as a plain value so
  // that when React sets it via a callback ref (null → element) the state
  // update propagates here and re-runs the effect with the real root.
  scrollRoot: HTMLElement | null,
) {
  const [activeSection, setActiveSection] = useState<string | null>(
    sectionIds[0] ?? null,
  );

  // Plain ref — updates to this flag must NOT cause re-renders; it's purely
  // for synchronous gating inside the observer callback.
  const isProgrammaticScroll = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scrollspy IntersectionObserver ─────────────────────────────────────────
  useEffect(() => {
    // Bail until the scroll container has been mounted and passed in.
    if (!scrollRoot) return;

    // root: scrollRoot — the <main> overflow container.
    // Using the actual scroll container as root ensures the observer fires on
    // every scroll tick within <main>, not on window scroll events.
    const observer = new IntersectionObserver(
      (entries) => {
        // While a click-triggered scroll is running, suppress all updates so
        // the sidebar highlight doesn't flicker through every passed section.
        if (isProgrammaticScroll.current) return;

        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;

        const id = hit.target.id;
        setActiveSection(id);
        // replaceState: updates the URL bar without pushing a history entry,
        // without triggering a browser scroll, and without a React re-render.
        window.history.replaceState(null, "", `#${id}`);
      },
      { root: scrollRoot, rootMargin: SCROLLSPY_MARGIN },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds, scrollRoot]);
  // scrollRoot is passed as a plain value (not a ref), so when it transitions
  // from null → HTMLElement (callback ref fires), the parent re-renders and
  // this effect re-runs with the real element — no timing hole.

  // ── Initial hash scroll ────────────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || !(sectionIds as readonly string[]).includes(hash)) return;

    // Short delay lets the DOM finish painting before we trigger the scroll.
    const t = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    }, 150);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // ── Programmatic scroll (called by sidebar link clicks) ────────────────────
  const scrollToSection = useCallback((id: string) => {
    // Lock BEFORE scrolling so the observer ignores intermediate sections.
    isProgrammaticScroll.current = true;
    // Immediately reflect the target — no flicker even if scroll takes time.
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);

    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

    // Release the lock after the animation completes.
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, SCROLL_LOCK_MS);
  }, []);

  return { activeSection, scrollToSection };
}
