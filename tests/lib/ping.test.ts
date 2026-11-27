import { afterEach, describe, expect, it, vi } from "vitest";
import { pingSite } from "../../app/lib/ping";

describe("pingSite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warms up the connection silently and returns the fastest warm HEAD sample", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("fetch", fetchMock);

    // Warmup isn't timed; sample 1 = 42ms (100 -> 142), sample 2 = 28ms (200 -> 228).
    const nowValues = [100, 142, 200, 228];
    vi.spyOn(performance, "now").mockImplementation(() => nowValues.shift() ?? 0);

    const ms = await pingSite("https://crates.io/crates/sjl");

    expect(ms).toBe(28);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://crates.io/favicon.ico",
      expect.objectContaining({
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      }),
    );
  });

  it("returns null when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await expect(pingSite("https://anyba.se")).resolves.toBeNull();
  });
});
