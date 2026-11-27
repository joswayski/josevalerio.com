import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout engine, so the router's scroll restoration would throw.
vi.stubGlobal("scrollTo", () => {});
// Keep unit tests offline when client components measure cross-origin latency.
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve(new Response())),
);

afterEach(() => {
  cleanup();
});
