import { DriveBackups, FOLDER_NAME } from './drive';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

test('creates the backup folder once and reuses it', async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(json({ files: [] }))
    .mockResolvedValueOnce(json({ id: 'folder1' }));
  vi.stubGlobal('fetch', f);
  const d = new DriveBackups(async () => 'tok');
  expect(await d.folderId()).toBe('folder1');
  expect(await d.folderId()).toBe('folder1');
  expect(f).toHaveBeenCalledTimes(2);
  expect(decodeURIComponent(String(f.mock.calls[0][0]))).toContain(`name='${FOLDER_NAME}'`);
  expect(JSON.parse(String((f.mock.calls[1][1] as RequestInit).body))).toMatchObject({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' });
  expect(((f.mock.calls[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer tok');
});

test('upload sends name, folder and content', async () => {
  const f = vi.fn().mockResolvedValueOnce(json({ files: [{ id: 'folder1' }] })).mockResolvedValueOnce(json({ id: 'file1' }));
  vi.stubGlobal('fetch', f);
  const id = await new DriveBackups(async () => 'tok').upload('Music Bingo backup 2026-11-26 21-30.json', '{"a":1}');
  expect(id).toBe('file1');
  const [url, init] = f.mock.calls[1] as [string, RequestInit];
  expect(url).toContain('uploadType=multipart');
  const body = String(init.body);
  expect(body).toContain('"parents":["folder1"]');
  expect(body).toContain('Music Bingo backup 2026-11-26 21-30.json');
  expect(body).toContain('{"a":1}');
});

test('list returns newest first; prune deletes beyond the newest 20', async () => {
  const files = Array.from({ length: 23 }, (_, i) => ({ id: `f${i}`, name: `b${i}`, createdTime: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`, size: '10' }));
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("name='")) return json({ files: [{ id: 'folder1' }] });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return json({ files: [...files].reverse() });
  });
  vi.stubGlobal('fetch', f);
  const d = new DriveBackups(async () => 'tok');
  const list = await d.list();
  expect(list[0].id).toBe('f22');
  expect(list[0].size).toBe(10);
  await d.prune(20);
  const deleted = f.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE').map(([u]) => String(u).split('/').pop());
  expect(deleted.sort()).toEqual(['f0', 'f1', 'f2']);
});

test('download returns the file text', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"format":"music-bingo-backup"}', { status: 200 })));
  expect(await new DriveBackups(async () => 'tok').download('x')).toBe('{"format":"music-bingo-backup"}');
});

test('errors are readable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { message: 'Insufficient Permission' } }, 403)));
  await expect(new DriveBackups(async () => 'tok').list()).rejects.toThrow(/Google Drive: Insufficient Permission/);
});
