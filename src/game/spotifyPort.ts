import type { SpotifyApi, SpotifyError } from '../spotify/api';
import type { PlaybackPort } from './controller';
import { throttleVolume } from './spotifyVolume';

export interface SpotifyPortDeps {
  api(): Pick<SpotifyApi, 'play' | 'pause' | 'resume' | 'seek' | 'volume'>;
  /** Selected Spotify device id. */
  device(): string | null;
  /** The in-browser player, only when it is the selected device. */
  browserPlayer(): Spotify.Player | null;
  wait(ms: number): Promise<void>;
}

const VERIFY_TRIES = 10;
const VERIFY_STEP_MS = 200;

/**
 * Plays through Spotify. Starting a song always goes through Spotify's servers, but the in-browser
 * player is paused/resumed/seeked locally (instant). A freshly started in-browser song can report
 * "playing" while the browser keeps it silent; we check and retry once (pause, then play again).
 */
export function createSpotifyPort(d: SpotifyPortDeps): PlaybackPort {
  const dev = () => {
    const id = d.device();
    if (!id) throw new Error('No Spotify device selected. Pick a device in the console.');
    return id;
  };
  const remoteVolume = throttleVolume((v) => (d.device() ? d.api().volume(d.device()!, v) : Promise.resolve()), 500);

  const reallyPlaying = async (player: Spotify.Player) => {
    for (let i = 0; i < VERIFY_TRIES; i++) {
      const st = await player.getCurrentState().catch(() => null);
      if (st && !st.paused && st.position > 0) return true;
      await d.wait(VERIFY_STEP_MS);
    }
    return false;
  };

  return {
    prime() {
      // Must run inside the click/keypress: lets the browser play the in-browser player's audio.
      void d.browserPlayer()?.activateElement().catch(() => {});
    },
    async play(uri, pos) {
      try {
        await d.api().play(dev(), uri, pos);
        const player = d.browserPlayer();
        if (player && !(await reallyPlaying(player))) {
          await player.pause().catch(() => {});
          await d.api().play(dev(), uri, pos);
        }
      } catch (e) {
        // Device/auth problems affect every song: stop instead of skipping through the list.
        const status = (e as SpotifyError).status;
        const msg = e instanceof Error ? e.message : String(e);
        if (status === 401 || status === 403 || status === 429 || (status === 404 && /device|player/i.test(msg)) || /No Spotify device|Connect Spotify/i.test(msg))
          throw Object.assign(e instanceof Error ? e : new Error(msg), { fatal: true });
        throw e;
      }
    },
    async pause() { const p = d.browserPlayer(); if (p) await p.pause(); else await d.api().pause(dev()); },
    async resume() { const p = d.browserPlayer(); if (p) await p.resume(); else await d.api().resume(dev()); },
    async seek(ms) { const p = d.browserPlayer(); if (p) await p.seek(Math.max(0, Math.round(ms))); else await d.api().seek(dev(), ms); },
    async setVolume(v) {
      const p = d.browserPlayer();
      if (p) await p.setVolume(Math.max(0, Math.min(1, v / 100)));
      else await remoteVolume(v);
    },
  };
}
