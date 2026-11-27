import type { ReactNode } from "react";

type VguiWindowProps = {
  title: string;
  children: ReactNode;
  statusBar?: ReactNode;
  className?: string;
};

/** Classic Valve VGUI dialog frame (Counter-Strike 1.6 / Steam Server Browser chrome). */
export function VguiWindow({ title, children, statusBar, className = "" }: VguiWindowProps) {
  return (
    <div className={`vgui-window ${className}`.trim()}>
      <div className="vgui-titlebar" aria-hidden="true">
        <div className="vgui-titlebar-left">
          <svg
            className="vgui-title-icon"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            focusable="false"
          >
            <rect x="1" y="1" width="12" height="5" fill="#23291e" stroke="#88967c" />
            <rect x="1" y="8" width="12" height="5" fill="#23291e" stroke="#88967c" />
            <rect x="3" y="3" width="2" height="1" fill="#6ae06a" />
            <rect x="6" y="3" width="4" height="1" fill="#c4b550" />
            <rect x="3" y="10" width="2" height="1" fill="#6ae06a" />
            <rect x="6" y="10" width="4" height="1" fill="#9ea894" />
          </svg>
          <span className="vgui-titlebar-text">{title}</span>
        </div>
        <div className="vgui-titlebar-controls">
          <span className="vgui-window-btn">_</span>
          <span className="vgui-window-btn">×</span>
        </div>
      </div>

      <div className="vgui-window-body">{children}</div>

      {statusBar && <div className="vgui-statusbar">{statusBar}</div>}
    </div>
  );
}
