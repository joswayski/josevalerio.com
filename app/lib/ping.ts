const PING_TIMEOUT_MS = 5_000;
const WARM_SAMPLES = 2;

/**
 * Measures real browser-to-origin HTTP round-trip latency using HEAD /favicon.ico.
 * Runs a silent warmup request first so cold DNS/TCP/TLS handshakes aren't shown as ping,
 * then returns the minimum RTT across warm keep-alive probes (or null on failure/abort).
 */
export async function pingSite(url: string, parentSignal?: AbortSignal): Promise<number | null> {
  if (typeof fetch !== "function") return null;

  const target = new URL("/favicon.ico", url).toString();
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  const timeoutId = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const init: RequestInit = {
    method: "HEAD",
    mode: "no-cors",
    cache: "no-store",
    signal: controller.signal,
  };

  try {
    // Warm up DNS + TCP + TLS silently before measuring actual RTT.
    await fetch(target, init);

    let best: number | null = null;
    for (let i = 0; i < WARM_SAMPLES; i += 1) {
      const start = performance.now();
      await fetch(target, init);
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      best = best === null ? elapsed : Math.min(best, elapsed);
    }
    return best;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
