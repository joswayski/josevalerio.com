import type { ReactNode } from "react";

type VguiWindowProps = {
  header?: ReactNode;
  title?: string;
  children: ReactNode;
  statusText?: ReactNode;
  className?: string;
};

/** Classic Counter-Strike 1.6 / Steam VGUI window frame. */
export function VguiWindow({
  header,
  title,
  children,
  statusText,
  className = "",
}: VguiWindowProps) {
  return (
    <div className={`vgui-window ${className}`.trim()}>
      <div className="vgui-titlebar">
        <div className="vgui-titlebar-main">
          {header ?? (title ? <span className="vgui-titlebar-text">{title}</span> : null)}
        </div>
        <span className="vgui-close-btn" aria-hidden="true">
          ×
        </span>
      </div>

      <div className="vgui-window-body">{children}</div>

      <div className="vgui-footer">
        <div className="vgui-footer-status">{statusText}</div>
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
      </div>
    </div>
  );
}
