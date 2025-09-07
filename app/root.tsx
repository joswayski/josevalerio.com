import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Toaster } from "sonner";
import { useLocalStorage } from "@mantine/hooks";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [alertDismissed, setAlertDismissed] = useLocalStorage({
    key: 'migration-alert-dismissed',
    defaultValue: false,
  });

  if (alertDismissed) {
    return <Outlet />;
  }

  return (
    <div>
      <Outlet />
      
      {/* Fixed bottom alert */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4">
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded-lg shadow-2xl max-w-4xl w-full mx-4 relative" role="alert">
          <button
            onClick={() => setAlertDismissed(true)}
            className="absolute top-1/2 transform -translate-y-1/2 right-2 text-orange-700 hover:text-orange-900 hover:bg-orange-200 transition-colors cursor-pointer w-8 h-8 rounded-full flex items-center justify-center text-lg"
            aria-label="Close alert"
          >
            ✕
          </button>
          <strong className="font-bold">Hi!!!</strong>
          <span className="block sm:inline"> I'm currently migrating to on prem :) Sorry for any issues!</span>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
