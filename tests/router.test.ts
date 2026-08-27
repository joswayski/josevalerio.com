import { describe, expect, it } from "vitest";
import { getRouter } from "../app/router";
import { postPreviews } from "../app/data/postPreviews";

describe("getRouter", () => {
  it("enables intent preloading and scroll restoration", () => {
    const router = getRouter();

    expect(router.options.defaultPreload).toBe("intent");
    expect(router.options.scrollRestoration).toBe(true);
  });

  it("registers a route for every published post plus the 404 page", () => {
    const paths = Object.keys(getRouter().routesById);

    for (const post of postPreviews) {
      expect(paths).toContain(post.link);
    }
    expect(paths).toContain("/404");
  });

  it("returns an independent router per call", () => {
    expect(getRouter()).not.toBe(getRouter());
  });
});
