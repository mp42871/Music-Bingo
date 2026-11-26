export const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state',
  'user-modify-playback-state', 'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public',
].join(' ');

export function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}
