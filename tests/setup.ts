import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout engine, so the router's scroll restoration would throw.
vi.stubGlobal("scrollTo", () => {});

afterEach(() => {
  cleanup();
});
