"use client";

import { useEffect, useRef, useState } from "react";

interface LazySectionProps {
  id: string;
  /** Render prop — receives `enabled` (true once the section enters the pre-load zone). */
  children: (enabled: boolean) => React.ReactNode;
  className?: string;
}

export function LazySection({ id, children, className }: LazySectionProps) {
  const ref = useRef<HTMLElement>(null);
  // Latch: once true it never goes back to false, so scrolling away and back
  // does NOT reset the flag or cause a refetch.
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    // Skip creating an observer once the latch has already fired.
    if (!ref.current || hasBeenVisible) return;

    // rootMargin "200px 0px" expands the intersection zone by 200 px above and
    // below the viewport, so the observer fires slightly before the section
    // actually enters view — giving us time to start the data fetch early.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true); // latch
          observer.disconnect();   // one-shot: we don't need further callbacks
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  return (
    <section
      id={id}
      ref={ref}
      // scroll-margin-top reserves clearance at the top of the scroll container
      // so the section heading isn't flush against the edge when scrolled to.
      className={`scroll-mt-4 ${className ?? ""}`.trim()}
    >
      {children(hasBeenVisible)}
    </section>
  );
}
