import { useRef, useState, type PointerEvent, type ReactNode } from "react";

type VguiWindowProps = {
  header?: ReactNode;
  title?: string;
  children: ReactNode;
  statusText?: ReactNode;
  className?: string;
};

type WindowSize = {
  width: number;
  height: number;
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 260;

/** Classic Counter-Strike 1.6 / Steam VGUI window frame with interactive corner resizing. */
export function VguiWindow({
  header,
  title,
  children,
  statusText,
  className = "",
}: VguiWindowProps) {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [size, setSize] = useState<WindowSize | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  function handleResizeStart(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const node = windowRef.current;
    if (!node) return;

    event.preventDefault();
    const rect = node.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleResizeMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - 24);
    const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 32, drag.startHeight + 360);

    // The window is horizontally centered, so 2*dx keeps the bottom-right corner locked to the cursor.
    const nextWidth = Math.round(Math.min(maxWidth, Math.max(MIN_WIDTH, drag.startWidth + dx * 2)));
    const nextHeight = Math.round(Math.min(maxHeight, Math.max(MIN_HEIGHT, drag.startHeight + dy)));
    setSize({ width: nextWidth, height: nextHeight });
  }

  function handleResizeEnd(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const inlineStyle = size
    ? {
        width: `${size.width}px`,
        height: `${size.height}px`,
      }
    : undefined;

  return (
    <div
      ref={windowRef}
      style={inlineStyle}
      className={`vgui-window ${size ? "vgui-window--resized" : ""} ${isResizing ? "vgui-window--resizing" : ""} ${className}`.trim()}
    >
      <div className="vgui-titlebar">
        <div className="vgui-titlebar-main">
          {header ?? (title ? <span className="vgui-titlebar-text">{title}</span> : null)}
        </div>
      </div>

      <div className="vgui-window-body">{children}</div>

      <div className="vgui-footer">
        <div className="vgui-footer-status">{statusText}</div>
        <button
          type="button"
          className="vgui-resize-handle"
          aria-label="Resize window"
          title="Drag to resize (double-click to reset)"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onDoubleClick={() => setSize(null)}
        >
          <svg
            className="vgui-resize-grip"
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="9" y="1" width="2" height="2" fill="#282e22" />
            <rect x="8" y="0" width="2" height="2" fill="#889180" />
            <rect x="5" y="5" width="2" height="2" fill="#282e22" />
            <rect x="4" y="4" width="2" height="2" fill="#889180" />
            <rect x="9" y="5" width="2" height="2" fill="#282e22" />
            <rect x="8" y="4" width="2" height="2" fill="#889180" />
            <rect x="1" y="9" width="2" height="2" fill="#282e22" />
            <rect x="0" y="8" width="2" height="2" fill="#889180" />
            <rect x="5" y="9" width="2" height="2" fill="#282e22" />
            <rect x="4" y="8" width="2" height="2" fill="#889180" />
            <rect x="9" y="9" width="2" height="2" fill="#282e22" />
            <rect x="8" y="8" width="2" height="2" fill="#889180" />
          </svg>
        </button>
      </div>
    </div>
  );
}
