import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import type { QueryClient } from "@tanstack/react-query";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{
  queryContext: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Jose Valerio",
        description: `Supply Chain Engineering at StockX. Memer. Don't sleep much.`,
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-950">
        {/*<div className="p-2 flex gap-2 text-lg">
         <Link
            to="/"
            activeProps={{
              className: "font-bold",
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{" "}
          <Link
            to="/posts"
            activeProps={{
              className: "font-bold",
            }}
          >
            Posts
          </Link>{" "}
          <Link
            to="/users"
            activeProps={{
              className: "font-bold",
            }}
          >
            Users
          </Link>{" "}
          <Link
            to="/route-a"
            activeProps={{
              className: "font-bold",
            }}
          >
            Pathless Layout
          </Link>{" "}
          <Link
            to="/deferred"
            activeProps={{
              className: "font-bold",
            }}
          >
            Deferred
          </Link>{" "}
          <Link
            // @ts-expect-error
            to="/this-route-does-not-exist"
            activeProps={{
              className: "font-bold",
            }}
          >
            This Route Does Not Exist
          </Link>
        </div>*/}
        <Toaster />
        {children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
