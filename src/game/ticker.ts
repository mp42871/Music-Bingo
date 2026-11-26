/**
 * A steady tick that keeps going when the console tab is in the background.
 * Browsers slow page timers in hidden tabs (to once a second, or once a minute after a while),
 * which froze the song clock while Spotify kept playing. Timers inside a worker aren't slowed that way.
 */
export function startTicker(fn: () => void, ms: number): () => void {
  let worker: Worker | null = null;
  let url: string | null = null;
  try {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = () => fn();
    }
  } catch { worker = null; }
  // Also a normal timer: covers browsers without workers, and costs nothing (ticks measure real time).
  const t = setInterval(fn, ms);
  return () => {
    clearInterval(t);
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
  };
}
