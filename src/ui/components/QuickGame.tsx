import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnline } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';
import type { Preset } from '../../core/presets';
import { buildQuickGame, requestTitle, type QuickRequest } from '../../game/quickGame';
import { NumberInput } from './NumberInput';
import { PresetPicker } from './PresetPicker';

type Mode = 'preset' | 'artist' | 'text';

/** Crowd request → playlist, cards and game in one step. */
export function QuickGame({ onClose }: { onClose(): void }) {
  const nav = useNavigate();
  const { api, connected } = useSpotify();
  const online = useOnline();
  const [mode, setMode] = useState<Mode>('preset');
  const [preset, setPreset] = useState<Preset | null>(null);
  const [artist, setArtist] = useState('');
  const [text, setText] = useState('');
  const [songs, setSongs] = useState(50);
  const [cards, setCards] = useState(40);
  const [size, setSize] = useState<3 | 4 | 5>(5);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const req: QuickRequest | null =
    mode === 'preset' ? (preset ? { kind: 'preset', preset } : null)
      : mode === 'artist' ? (artist.trim() ? { kind: 'artist', name: artist } : null)
        : text.trim() ? { kind: 'text', text } : null;

  const start = async () => {
    if (!req) return;
    setErr(null);
    try {
      const { game } = await buildQuickGame(api, req, { songs, cards, size }, setStep);
      onClose();
      nav(`/console/${game.id}?new=1`);
    } catch (e) {
      setStep(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const tabs: [Mode, string][] = [['preset', 'A category'], ['artist', 'An artist'], ['text', 'Anything else']];

  return (
    <div role="dialog" aria-modal="true" aria-label="Quick game" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="panel mt-8 w-full max-w-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Quick game</h2>
          <button type="button" className="btn px-3" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {!connected || !online ? (
          <p className="text-peak">{!online ? 'Quick games need internet to find songs on Spotify.' : 'Connect Spotify in Settings first.'}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-dim">What did they ask for? The app builds the playlist, cards and game, then opens the DJ console with the phone-card QR showing.</p>
            <div role="tablist" className="mb-3 flex flex-wrap gap-1">
              {tabs.map(([id, label]) => (
                <button key={id} type="button" role="tab" className="chip" aria-selected={mode === id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>
              ))}
            </div>
            {mode === 'preset' && <PresetPicker mode="pick" selected={preset ? [preset.id] : []} onPick={setPreset} disabled={!!step} />}
            {mode === 'artist' && <input aria-label="Artist" placeholder="e.g. Taylor Swift, Queen, Garth Brooks" value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full" />}
            {mode === 'text' && (
              <div className="grid gap-1">
                <input aria-label="Search words" placeholder="e.g. disney, yacht rock, love songs" value={text} onChange={(e) => setText(e.target.value)} className="w-full" />
                <span className="text-xs text-peak">Keyword search — songs are a loose match. Use a category when one fits.</span>
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1"><span className="label">Songs</span>
                <select aria-label="Songs" value={songs} onChange={(e) => setSongs(Number(e.target.value))}>
                  {[30, 50, 75].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="label">Cards</span>
                <NumberInput aria-label="Cards" value={cards} min={1} max={500} onChange={setCards} className="w-full" />
              </label>
              <div className="flex flex-col gap-1" role="group" aria-labelledby="qg-size"><span id="qg-size" className="label">Card size</span>
                <div className="flex gap-1.5">{([3, 4, 5] as const).map((n) => <button key={n} type="button" className="chip" aria-pressed={size === n} onClick={() => setSize(n)}>{n}×{n}</button>)}</div>
              </div>
            </div>
            {req && <p className="mt-3 text-sm">Game name: <strong>{requestTitle(req)}</strong></p>}
            {step && <p role="status" className="mt-3 text-deck-a">{step}</p>}
            {err && <p role="alert" className="mt-3 text-deck-b">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-b" disabled={!req || !!step} onClick={start}>{step ? 'Building…' : 'Start the game'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
