/// <reference types="vite/client" />

import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import appCss from "../app.css?url";
import { NotFoundPage } from "../components/NotFoundPage";
import { getSocialMeta } from "../data/siteMeta";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f2f3f5" },
      { title: "Jose Valerio" },
      { name: "description", content: "Jose Valerio's personal website" },
      ...getSocialMeta(),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});

function RootDocument() {
  const isStatic404 = useRouterState({
    select: (state) => state.location.pathname === "/404",
  });

  return (
    <RootHtml includeScripts={!isStatic404}>
      <Outlet />
    </RootHtml>
  );
}

function RootHtml({
  children,
  includeScripts,
}: {
  children: ReactNode;
  includeScripts: boolean;
}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {includeScripts && <Scripts />}
      </body>
    </html>
  );
}

function ErrorPage({ error }: { error: Error }) {
  return (
    <main className="error-page">
      <h1>Oops!</h1>
      <p>
        {import.meta.env.DEV
          ? error.message
          : "An unexpected error occurred."}
      </p>
      <Link to="/">Return home →</Link>
      {import.meta.env.DEV && error.stack && (
        <pre>
          <code>{error.stack}</code>
        </pre>
      )}
    </main>
  );
}
