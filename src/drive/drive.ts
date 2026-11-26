export const FOLDER_NAME = 'Music Bingo Backups';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface BackupFile { id: string; name: string; createdTime: string; size: number }

/** Backups live as JSON files in one Drive folder the app creates (scope drive.file: only files it made). */
export class DriveBackups {
  private folder: string | null = null;
  constructor(private getToken: () => Promise<string>) {}

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> ?? {}) } });
    if (!res.ok) {
      let msg = `request failed (${res.status})`;
      try { msg = (await res.json())?.error?.message ?? msg; } catch { /* not json */ }
      throw new Error(`Google Drive: ${msg}`);
    }
    return res;
  }

  async folderId(): Promise<string> {
    if (this.folder) return this.folder;
    const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const found = await (await this.req(`${API}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`)).json();
    if (found.files?.[0]?.id) return (this.folder = found.files[0].id as string);
    const made = await (await this.req(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    return (this.folder = made.id as string);
  }

  async upload(name: string, content: string): Promise<string> {
    const parent = await this.folderId();
    const boundary = `mb${Math.random().toString(36).slice(2)}`;
    const body = [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '',
      JSON.stringify({ name, parents: [parent], mimeType: 'application/json' }),
      `--${boundary}`, 'Content-Type: application/json', '', content, `--${boundary}--`, '',
    ].join('\r\n');
    const res = await this.req(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    return (await res.json()).id;
  }

  async list(): Promise<BackupFile[]> {
    const parent = await this.folderId();
    const q = `'${parent}' in parents and trashed=false`;
    const r = await (await this.req(`${API}?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,createdTime,size)`)).json();
    return (r.files ?? [])
      .map((f: { id: string; name: string; createdTime: string; size?: string }) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size ?? 0) }))
      .sort((a: BackupFile, b: BackupFile) => b.createdTime.localeCompare(a.createdTime));
  }

  async download(id: string): Promise<string> {
    return (await this.req(`${API}/${encodeURIComponent(id)}?alt=media`)).text();
  }

  async prune(keep = 20): Promise<void> {
    const old = (await this.list()).slice(keep);
    for (const f of old) await this.req(`${API}/${encodeURIComponent(f.id)}`, { method: 'DELETE' });
  }
}
