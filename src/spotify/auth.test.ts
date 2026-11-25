import { challengeFor, createPkcePair, getAccessToken, saveTokens, TOKENS_KEY } from './auth';

test('PKCE challenge matches RFC 7636 vector', async () => {
  expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('createPkcePair makes a 64-char verifier', async () => {
  const { verifier, challenge } = await createPkcePair();
  expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
  expect(challenge).toBe(await challengeFor(verifier));
});

test('getAccessToken returns a fresh token without refreshing', async () => {
  saveTokens({ access_token: 'A', refresh_token: 'R', expires_in: 3600 });
  const f = vi.fn();
  vi.stubGlobal('fetch', f);
  expect(await getAccessToken('cid')).toBe('A');
  expect(f).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('getAccessToken refreshes when expired', async () => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'old', refreshToken: 'R', expiresAt: Date.now() - 1000 }));
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }), { status: 200 }));
  vi.stubGlobal('fetch', f);
  expect(await getAccessToken('cid')).toBe('new');
  expect(f).toHaveBeenCalledTimes(1);
  const body = String((f.mock.calls[0][1] as RequestInit).body);
  expect(body).toContain('grant_type=refresh_token');
  expect(body).toContain('refresh_token=R');
  expect(JSON.parse(localStorage.getItem(TOKENS_KEY)!).refreshToken).toBe('R');
  vi.unstubAllGlobals();
});

test('getAccessToken returns null when not logged in', async () => {
  localStorage.removeItem(TOKENS_KEY);
  expect(await getAccessToken('cid')).toBeNull();
});

test('a refresh that fails for network reasons throws a network error instead of looking logged out', async () => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'old', refreshToken: 'R', expiresAt: Date.now() - 1000 }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(getAccessToken('cid')).rejects.toBeInstanceOf(TypeError);
  expect(localStorage.getItem(TOKENS_KEY)).not.toBeNull();
  vi.unstubAllGlobals();
});
