import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";

type VguiScrollAreaProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

type ScrollMetrics = {
  canScroll: boolean;
  thumbHeightPct: number;
  thumbTopPct: number;
};

const MIN_THUMB_PCT = 16;
const ARROW_STEP_PX = 64;

/**
 * Scrollable VGUI box with a single authentic CS 1.6 scrollbar synced to real native scrolling
 * (wheel, trackpad, touch, arrow clicks, track clicks, and thumb dragging).
 */
export function VguiScrollArea({
  children,
  className = "",
  contentClassName = "",
}: VguiScrollAreaProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    maxScroll: number;
    usableTrackPx: number;
  } | null>(null);

  const [metrics, setMetrics] = useState<ScrollMetrics>({
    canScroll: false,
    thumbHeightPct: 100,
    thumbTopPct: 0,
  });

  const syncMetrics = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 1 || scrollHeight <= 0) {
      setMetrics((prev) =>
        prev.canScroll || prev.thumbHeightPct !== 100 || prev.thumbTopPct !== 0
          ? { canScroll: false, thumbHeightPct: 100, thumbTopPct: 0 }
          : prev,
      );
      return;
    }

    const thumbHeightPct = Math.max(MIN_THUMB_PCT, (clientHeight / scrollHeight) * 100);
    const thumbTopPct = (scrollTop / maxScroll) * (100 - thumbHeightPct);

    setMetrics({
      canScroll: true,
      thumbHeightPct,
      thumbTopPct,
    });
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    syncMetrics();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncMetrics());
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [syncMetrics, children]);

  function scrollByAmount(deltaY: number) {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTop += deltaY;
    syncMetrics();
  }

  function handleRailWheel(event: WheelEvent<HTMLDivElement>) {
    const el = contentRef.current;
    if (!el || !metrics.canScroll) return;
    el.scrollTop += event.deltaY;
    syncMetrics();
  }

  function handleTrackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== trackRef.current) return;
    const el = contentRef.current;
    const track = trackRef.current;
    if (!el || !track || !metrics.canScroll) return;

    const rect = track.getBoundingClientRect();
    const clickPct = ((event.clientY - rect.top) / rect.height) * 100;
    const step = el.clientHeight * 0.85;
    if (clickPct < metrics.thumbTopPct) {
      scrollByAmount(-step);
    } else if (clickPct > metrics.thumbTopPct + metrics.thumbHeightPct) {
      scrollByAmount(step);
    }
  }

  function handleThumbPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const el = contentRef.current;
    const track = trackRef.current;
    if (!el || !track || !metrics.canScroll) return;

    event.preventDefault();
    event.stopPropagation();

    const maxScroll = el.scrollHeight - el.clientHeight;
    const trackHeight = track.getBoundingClientRect().height;
    const thumbPx = (metrics.thumbHeightPct / 100) * trackHeight;
    const usableTrackPx = Math.max(1, trackHeight - thumbPx);

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: el.scrollTop,
      maxScroll,
      usableTrackPx,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleThumbPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = contentRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;

    const dy = event.clientY - drag.startY;
    const nextScrollTop = drag.startScrollTop + (dy / drag.usableTrackPx) * drag.maxScroll;
    el.scrollTop = Math.min(drag.maxScroll, Math.max(0, nextScrollTop));
    syncMetrics();
  }

  function handleThumbPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className={`vgui-browser-box ${className}`.trim()}>
      <div
        ref={contentRef}
        className={`vgui-browser-content ${contentClassName}`.trim()}
        onScroll={syncMetrics}
      >
        <div className="vgui-scroll-inner">{children}</div>
      </div>

      <div
        className={`vgui-scrollbar ${metrics.canScroll ? "" : "vgui-scrollbar--idle"}`.trim()}
        onWheel={handleRailWheel}
        aria-hidden="true"
      >
        <button
          type="button"
          tabIndex={-1}
          className="vgui-scroll-arrow"
          disabled={!metrics.canScroll}
          onClick={() => scrollByAmount(-ARROW_STEP_PX)}
        >
          ▲
        </button>
        <div ref={trackRef} className="vgui-scroll-track" onPointerDown={handleTrackPointerDown}>
          <div
            className="vgui-scroll-thumb"
            style={{
              height: `${metrics.thumbHeightPct}%`,
              top: `${metrics.thumbTopPct}%`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="vgui-scroll-arrow"
          disabled={!metrics.canScroll}
          onClick={() => scrollByAmount(ARROW_STEP_PX)}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
