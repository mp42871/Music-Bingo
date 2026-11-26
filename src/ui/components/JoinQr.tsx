import { QR } from './QR';

/** Longest phone link a full-screen QR can still carry reliably. */
export const MAX_PHONE_URL = 2900;

/** Full-screen "join on your phone" overlay for the host's own screen. */
export function JoinQr({ live, phoneUrl, onClose }: {
  live: { code: string; joinUrl: string; site: string } | null; phoneUrl: string | null; onClose(): void;
}) {
  const url = live?.joinUrl ?? phoneUrl;
  const tooLong = !live && !!phoneUrl && phoneUrl.length > MAX_PHONE_URL;
  return (
    <div role="dialog" aria-modal="true" aria-label="Join on your phone" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-4 text-night" onClick={onClose}>
      {url && !tooLong ? (
        <>
          <QR text={url} size={1200} className="h-[70vh] w-[70vh] max-w-[92vw]" />
          <div className="text-3xl font-bold">Scan to get your card</div>
          {live && live.site && <div className="text-xl">or type <strong>{`${live.site}/join`}</strong></div>}
          {live && <div className="text-xl">Game code <strong className="font-mono text-3xl">{live.code}</strong></div>}
        </>
      ) : (
        <p className="max-w-md text-center text-xl">This game has too many songs for a phone QR code without live play. Use 100 songs or fewer, or set up Live play in Settings.</p>
      )}
      <button type="button" className="rounded-lg border border-night px-4 py-2" onClick={onClose}>Close</button>
    </div>
  );
}
