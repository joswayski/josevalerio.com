import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const POST_PATHS = [
  "/just-do-the-thing",
  "/rust-json-logging",
  "/no-fun-allowed",
] as const;

/**
 * Renders a component inside a minimal router so `Link` resolves the same
 * paths the real route tree exposes.
 */
export async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{ui}</>,
  });
  const postRoutes = POST_PATHS.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    }),
  );

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, ...postRoutes]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  const result = render(<RouterProvider router={router} />);
  await router.load();
  return result;
}
