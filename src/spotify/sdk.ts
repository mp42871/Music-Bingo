let sdkReady: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  sdkReady ??= new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => { sdkReady = null; reject(new Error('Could not load the Spotify player. Check your internet connection.')); };
    document.body.appendChild(s);
  });
  return sdkReady;
}

/** Creates the in-browser Spotify Connect device. Requires Premium. */
export async function loadPlayer(
  getToken: () => Promise<string | null>,
  name = 'Music Bingo DJ',
  onError: (msg: string) => void = () => {},
): Promise<{ deviceId: string; player: Spotify.Player }> {
  await loadSdk();
  const player = new window.Spotify.Player({
    name,
    volume: 0.7,
    getOAuthToken: (cb) => { getToken().then((t) => t && cb(t)); },
  });
  player.addListener('initialization_error', ({ message }) => onError(`Player failed to start: ${message}`));
  player.addListener('authentication_error', ({ message }) => onError(`Spotify sign-in problem: ${message}. Reconnect in Settings.`));
  player.addListener('account_error', () => onError('Spotify Premium is required for in-browser playback.'));
  player.addListener('playback_error', ({ message }) => onError(`Playback error: ${message}`));
  const deviceId = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The Spotify player did not respond. Try again or pick another device.')), 15000);
    player.addListener('ready', ({ device_id }) => { clearTimeout(timer); resolve(device_id); });
    player.connect().then((ok) => { if (!ok) { clearTimeout(timer); reject(new Error('Could not connect the Spotify player.')); } });
  });
  return { deviceId, player };
}
