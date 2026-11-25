import type { Song } from '../core/types';
import { parsePlaylistId } from './query';
import { reportNetworkSuccess } from '../app/online';

export class SpotifyError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'SpotifyError';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function trackToSong(t: any): Song {
  const imgs: { url: string; width?: number }[] = t.album?.images ?? [];
  const art = [...imgs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
  const year = parseInt(String(t.album?.release_date ?? '').slice(0, 4), 10);
  return {
    id: t.id, uri: t.uri, title: t.name, artist: (t.artists ?? []).map((a: any) => a.name).join(', '),
    album: t.album?.name ?? '', ...(Number.isNaN(year) ? {} : { year }), durationMs: t.duration_ms ?? 0,
    ...(art ? { artUrl: art } : {}), categories: [],
  };
}

export interface Device { id: string; name: string; type: string; is_active: boolean; volume_percent: number | null }

const API = 'https://api.spotify.com/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SpotifyApi {
  constructor(private getToken: (force?: boolean) => Promise<string | null>) {}

  private async req<T = any>(path: string, init: RequestInit = {}, attempt = 0, refreshed = false): Promise<T> {
    const token = await this.getToken(refreshed);
    if (!token) throw new SpotifyError('Connect Spotify in Settings first.', 401);
    const res = await fetch(path.startsWith('http') ? path : API + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    reportNetworkSuccess();
    if (res.status === 429) {
      if (attempt >= 3) throw new SpotifyError('Spotify is busy (rate limit reached). Wait a minute and try again.', 429);
      const wait = Math.min(30, Number(res.headers.get('Retry-After') ?? '1') || 1);
      await sleep(wait * 1000);
      return this.req(path, init, attempt + 1, refreshed);
    }
    if (res.status === 401 && !refreshed) return this.req(path, init, attempt, true);
    if (res.status === 204 || res.status === 202) return undefined as T;
    const text = await res.text();
    const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
    if (!res.ok) {
      const msg = body?.error?.message ?? `Spotify request failed (${res.status}).`;
      const friendly =
        res.status === 404 && /device/i.test(msg) ? 'Spotify player not found. Pick a device or reconnect the in-browser player.' :
        res.status === 403 && /premium/i.test(msg) ? 'Spotify Premium is required for playback.' : msg;
      throw new SpotifyError(friendly, res.status);
    }
    return body as T;
  }

  me() {
    return this.req<{ id: string; display_name: string; product: string; images?: { url: string }[] }>('/me');
  }

  async searchTracks(q: string, offset = 0, limit = 10): Promise<{ songs: Song[]; total: number }> {
    const p = new URLSearchParams({ q, type: 'track', limit: String(limit), offset: String(offset) });
    const r = await this.req(`/search?${p}`);
    return { songs: (r.tracks?.items ?? []).filter(Boolean).map(trackToSong), total: r.tracks?.total ?? 0 };
  }

  async myPlaylists(): Promise<{ id: string; name: string; count: number; image?: string }[]> {
    const out: { id: string; name: string; count: number; image?: string }[] = [];
    let url: string | null = '/me/playlists?limit=50';
    while (url && out.length < 500) {
      const r: any = await this.req(url);
      for (const p of r.items ?? []) if (p) out.push({ id: p.id, name: p.name, count: p.tracks?.total ?? p.items?.total ?? 0, image: p.images?.[0]?.url });
      url = r.next;
    }
    return out;
  }

  async playlistSongs(idOrUrl: string): Promise<Song[]> {
    const id = parsePlaylistId(idOrUrl);
    if (!id) throw new SpotifyError('That doesn’t look like a Spotify playlist link.');
    const out: Song[] = [];
    let url: string | null = `/playlists/${id}/tracks?limit=50`;
    while (url && out.length < 2000) {
      const r: any = await this.req(url);
      for (const it of r.items ?? []) {
        const t = it?.track ?? it?.item;
        if (t?.id && t.type !== 'episode') out.push(trackToSong(t));
      }
      url = r.next;
    }
    return out;
  }

  async createPlaylist(name: string, uris: string[]): Promise<string> {
    const p = await this.req<{ id: string; external_urls?: { spotify?: string } }>('/me/playlists', {
      method: 'POST', body: JSON.stringify({ name, public: false, description: 'Made with Music Bingo' }),
    });
    for (let i = 0; i < uris.length; i += 100)
      await this.req(`/playlists/${p.id}/tracks`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
    return p.external_urls?.spotify ?? p.id;
  }

  async devices(): Promise<Device[]> {
    return (await this.req<{ devices: Device[] }>('/me/player/devices')).devices ?? [];
  }

  play(deviceId: string, uri: string, positionMs: number) {
    return this.req(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT', body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.round(positionMs)) }),
    });
  }
  pause(deviceId: string) {
    return this.req(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
  }
  resume(deviceId: string) {
    return this.req(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
  }
  seek(deviceId: string, ms: number) {
    return this.req(`/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
  }
  volume(deviceId: string, pct: number) {
    return this.req(`/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Math.round(pct)))}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
  }
  async state(): Promise<{ progress_ms: number; is_playing: boolean; device?: Device } | null> {
    return (await this.req('/me/player')) ?? null;
  }
  transfer(deviceId: string) {
    return this.req('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) });
  }
}
