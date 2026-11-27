const PING_TIMEOUT_MS = 5_000;

/**
 * Measures real browser-to-origin HTTP round-trip latency using a no-cors, no-store fetch.
 * Returns latency in milliseconds, or null if the request fails, times out, or is aborted.
 */
export async function pingSite(url: string, parentSignal?: AbortSignal): Promise<number | null> {
  if (typeof fetch !== "function") return null;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const timeoutId = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = performance.now();

  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return Math.max(1, Math.round(performance.now() - start));
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
