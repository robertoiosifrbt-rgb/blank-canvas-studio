import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';

const MIN_WIDTH = 768;

/**
 * ACHU-059 — Minimum Supported Viewport.
 *
 * The Admin Control Centre is designed for desktop viewports (≥ 768px).
 * This component overlays an unsupported-screen message when the
 * viewport is narrower than the minimum, preventing layout corruption
 * (table overflow, clipped dialogs, overlapping controls).
 *
 * Customer and Cleaner portals are unaffected — they have their own
 * mobile-friendly layouts.
 */
export default function MinViewportGuard({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : MIN_WIDTH,
  );

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (width < MIN_WIDTH) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <Monitor className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Larger Screen Required</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The ACHU Admin Control Centre is designed for desktop and tablet screens
            (768 px or wider). Please use a larger device or resize your browser window.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Current width: {width} px
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
