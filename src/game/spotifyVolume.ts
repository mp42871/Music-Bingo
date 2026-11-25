/** Sends at most one volume change per interval, always ending on the latest value (fades to external speakers). */
export function throttleVolume(send: (v: number) => Promise<void>, intervalMs = 500): (v: number) => Promise<void> {
  let last = 0;
  let pending: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (pending === null) return;
    const v = pending;
    pending = null;
    last = Date.now();
    send(v).catch(() => {});
  };
  return async (v) => {
    pending = v;
    const wait = intervalMs - (Date.now() - last);
    if (wait <= 0 && !timer) flush();
    else if (!timer) timer = setTimeout(flush, Math.max(0, wait));
  };
}
