export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries `fn` until it returns a truthy value or the timeout elapses. */
export async function waitFor<T>(
  fn: () => Promise<T | undefined | null | false> | T | undefined | null | false,
  { timeout = 15_000, interval = 250, message = 'Condition not met' } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (e) {
      lastError = e;
    }
    await sleep(interval);
  }
  throw new Error(`${message} (timeout ${timeout}ms)${lastError ? `: ${String(lastError)}` : ''}`);
}
