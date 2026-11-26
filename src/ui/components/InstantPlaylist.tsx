import { useState } from 'react';
import { useSpotify } from '../../app/spotifyStore';
import { PRESETS, presetQueries, type Preset } from '../../core/presets';
import { uid } from '../../core/rng';
import type { Pool, Song } from '../../core/types';
import { collect } from '../../spotify/collect';
import { collectCurated, parseCurated } from '../../spotify/curated';
import { shuffle } from '../../core/rng';
import { PresetPicker } from './PresetPicker';

const SIZES = [50, 75, 100, 150];

/** Builds a bingo playlist from quick categories — each picked category becomes a card column. */
export function InstantPlaylist({ onDone, onClose }: { onDone(p: Pool): void; onClose(): void }) {
  const { api, connected } = useSpotify();
  const [picked, setPicked] = useState<string[]>([]);
  const [size, setSize] = useState(75);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const chosen = picked.map((id) => PRESETS.find((p) => p.id === id)!).filter(Boolean);
  const toggle = (p: Preset) => setPicked((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]));

  const build = async () => {
    setErr(null);
    const per = Math.ceil(size / chosen.length);
    const seen = new Set<string>();
    const songs: Song[] = [];
    try {
      for (const [i, p] of chosen.entries()) {
        setBusy(`Finding ${p.name} songs (${i + 1} of ${chosen.length})…`);
        const want = Math.min(per, size - songs.length);
        const r = p.songs
          ? await collectCurated(api, shuffle(parseCurated(p.songs), Math.random), want, 0, seen)
          : await collect(api, presetQueries(p), want, undefined, seen);
        songs.push(...r.songs.map((s) => ({ ...s, categories: chosen.length > 1 ? [p.name] : [] })));
      }
    } catch (e) {
      setBusy(null);
      return setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
    if (!songs.length) return setErr('Spotify didn’t return any songs for those categories.');
    const now = Date.now();
    onDone({ id: uid(), name: name.trim() || chosen.map((p) => p.name).join(' + '), songs, categories: chosen.length > 1 ? chosen.map((p) => p.name) : [], createdAt: now, updatedAt: now });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Instant playlist" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="panel mt-8 w-full max-w-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Instant playlist</h2>
          <button type="button" className="btn px-3" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {!connected ? <p className="text-peak">Connect Spotify in Settings first.</p> : (
          <>
            <p className="mb-3 text-sm text-dim">Pick one or more categories. Each one becomes a card column, with songs split evenly. Themes and Occasions are hand-picked song lists (about 30–45 songs each); Decades and Genres search Spotify. You can trim the list afterwards.</p>
            <PresetPicker mode="multi" selected={picked} onPick={toggle} disabled={!!busy} />
            {chosen.length > 0 && <p className="mt-3 text-sm">Picked: <span className="text-deck-b">{chosen.map((p) => p.name).join(' · ')}</span></p>}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1"><span className="label">How many songs</span>
                <select aria-label="How many songs" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                  {SIZES.map((n) => <option key={n} value={n}>{n} songs</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="label">Playlist name</span>
                <input aria-label="Playlist name" value={name} placeholder={chosen.map((p) => p.name).join(' + ') || 'My instant playlist'} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
            {err && <p role="alert" className="mt-3 text-deck-b">{err}</p>}
            {busy && <p role="status" className="mt-3 text-deck-a">{busy}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-b" disabled={!chosen.length || !!busy} onClick={build}>Build playlist{chosen.length ? ` (${size} songs)` : ''}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
