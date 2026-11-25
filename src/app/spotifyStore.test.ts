import { useSpotify } from './spotifyStore';
import { TOKENS_KEY } from '../spotify/auth';

test('a rejected sign-in marks Spotify as disconnected', async () => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'old', refreshToken: 'R', expiresAt: Date.now() - 1000 }));
  useSpotify.setState({ connected: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 })));
  await expect(useSpotify.getState().api.searchTracks('x')).rejects.toThrow(/Connect Spotify/);
  expect(useSpotify.getState().connected).toBe(false);
  vi.unstubAllGlobals();
});
