import { useEffect, useState } from 'react';
import { useOnline } from '../../app/online';
import { useSpotify } from '../../app/spotifyStore';
import type { Device } from '../../spotify/api';
import { browserDeviceId, connectBrowserPlayer, getDevice, setDevice } from '../../game/store';

export function DevicePicker({ onError }: { onError(m: string): void }) {
  const { api, connected } = useSpotify();
  const [devices, setDevices] = useState<Device[]>([]);
  const [current, setCurrent] = useState<string | null>(getDevice());
  const [busy, setBusy] = useState(false);
  const online = useOnline();

  const refresh = () => api.devices().then(setDevices).catch((e) => onError(e.message));
  const useBrowser = async () => {
    setBusy(true);
    try { const id = await connectBrowserPlayer(onError); setCurrent(id); await refresh(); }
    catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!online) return;
    if (connected && !getDevice()) void useBrowser();
    else if (connected) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, online]);

  if (!online) return <span className="chip border-peak text-peak" title="Songs play from your music files, or you play them in the Spotify app">Offline — music files &amp; manual play</span>;
  if (!connected) return <span className="chip text-peak">Spotify not connected — <a className="underline" href="#/settings">connect</a></span>;
  return (
    <div className="flex items-center gap-2">
      <span className="label">Play on</span>
      <select aria-label="Spotify device" value={current ?? ''} onFocus={refresh}
        onChange={async (e) => {
          const v = e.target.value;
          if (v === '__browser') return useBrowser();
          setDevice(v); setCurrent(v);
          await api.transfer(v).catch(() => {});
        }}>
        {!current && <option value="">Choose a device…</option>}
        <option value="__browser">{busy ? 'Starting…' : 'This browser'}{browserDeviceId() && current === browserDeviceId() ? ' ✓' : ''}</option>
        {devices.filter((d) => d.id !== browserDeviceId()).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
      </select>
    </div>
  );
}
