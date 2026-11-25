/** Host's Spotify developer app Client ID (public by design for PKCE apps). Overridable in Settings. */
export const DEFAULT_CLIENT_ID = 'bbb45131b8a14409ad1cbe8d1c338d44';

export const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state',
  'user-modify-playback-state', 'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public',
].join(' ');

export function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}
