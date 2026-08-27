import { describe, expect, it } from "vitest";
import {
  JustDoTheThing,
  NoFunAllowed,
  RustJsonLogging,
  postPreviews,
} from "../../app/data/postPreviews";

describe("postPreviews", () => {
  it("lists every post exactly once", () => {
    expect(postPreviews).toEqual([NoFunAllowed, RustJsonLogging, JustDoTheThing]);
    expect(new Set(postPreviews.map((post) => post.link)).size).toBe(
      postPreviews.length,
    );
  });

  it("orders posts newest first", () => {
    const timestamps = postPreviews.map((post) =>
      new Date(post.dateTime).getTime(),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("keeps every post's dateTime a valid ISO date matching its display date", () => {
    for (const post of postPreviews) {
      expect(post.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${post.dateTime}T00:00:00Z`);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(
        parsed.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }),
      ).toBe(post.date);
    }
  });

  it("gives every post non-empty copy and a root-relative link", () => {
    for (const post of postPreviews) {
      expect(post.title.trim()).not.toBe("");
      expect(post.previewText.trim()).not.toBe("");
      expect(post.link.startsWith("/")).toBe(true);
    }
  });
});
