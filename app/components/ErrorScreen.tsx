import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

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
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to="/">Return home →</Link>
      {children}
    </main>
  );
}
