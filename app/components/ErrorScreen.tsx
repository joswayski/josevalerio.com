import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { VguiWindow } from "./VguiWindow";

export function ErrorScreen({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <main className="error-page">
      <VguiWindow
        title="Disconnect"
        className="vgui-window--dialog"
        statusBar={
          <span className="vgui-status-cell vgui-status-cell--grow">
            Connection closed // josevalerio.com
          </span>
        }
      >
        <div className="error-dialog-well">
          <h1>{title}</h1>
          <p>{message}</p>
          {children}
        </div>
        <div className="error-dialog-actions">
          <Link to="/" className="chip">
            ← Return home
          </Link>
        </div>
      </VguiWindow>
    </main>
  );
}
