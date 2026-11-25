import type { ControllerState } from '../../game/controller';

const Icon = ({ d, label }: { d: string; label: string }) => (
  <svg viewBox="0 0 24 24" className="size-6" aria-hidden><title>{label}</title><path d={d} fill="currentColor" /></svg>
);
const P = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z', next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z', replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  back: 'M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z', fwd: 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z',
  vol: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05A4.5 4.5 0 0016.5 12z', mute: 'M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
  mic: 'M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z',
};

export function Transport({ cs, onPrev, onReplay, onToggle, onNext, onBack, onFwd, onVolume, onMute, onDuck }: {
  cs: ControllerState; onPrev(): void; onReplay(): void; onToggle(): void; onNext(): void; onBack(): void; onFwd(): void;
  onVolume(v: number): void; onMute(): void; onDuck(): void;
}) {
  const playing = cs.phase === 'playing' || cs.phase === 'loading';
  const big = 'grid size-12 place-items-center rounded-full border border-rail bg-booth-2 hover:border-deck-a';
  return (
    <div className="panel flex flex-wrap items-center justify-center gap-3 p-4 lg:justify-between">
      <div className="flex items-center gap-2">
        <button type="button" className={big} onClick={onPrev} aria-label="Previous song" title="Previous (←)"><Icon d={P.prev} label="Previous" /></button>
        <button type="button" className={big} onClick={onBack} aria-label="Back 10 seconds" title="Back 10s"><Icon d={P.back} label="Back 10 seconds" /></button>
        <button type="button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)"
          className="grid size-16 place-items-center rounded-full bg-deck-b text-night shadow-[0_0_30px_-5px_var(--color-deck-b)] hover:brightness-110">
          <Icon d={playing ? P.pause : P.play} label={playing ? 'Pause' : 'Play'} />
        </button>
        <button type="button" className={big} onClick={onFwd} aria-label="Forward 10 seconds" title="Forward 10s"><Icon d={P.fwd} label="Forward 10 seconds" /></button>
        <button type="button" className={big} onClick={onNext} aria-label="Next song" title="Next (→)"><Icon d={P.next} label="Next" /></button>
        <button type="button" className={`${big} ml-1`} onClick={onReplay} aria-label="Replay last song" title="Replay (R)"><Icon d={P.replay} label="Replay" /></button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={`${big} ${cs.ducked ? 'border-peak text-peak' : ''}`} onClick={onDuck} aria-pressed={cs.ducked} aria-label="Talk over" title="Talk over — lowers music (T)"><Icon d={P.mic} label="Talk over" /></button>
        <button type="button" className={`${big} ${cs.muted ? 'border-deck-b text-deck-b' : ''}`} onClick={onMute} aria-pressed={cs.muted} aria-label={cs.muted ? 'Unmute' : 'Mute'} title="Mute (M)"><Icon d={cs.muted ? P.mute : P.vol} label="Mute" /></button>
        <input type="range" aria-label="Volume" min={0} max={100} value={cs.muted ? 0 : cs.volume} onChange={(e) => onVolume(Number(e.target.value))} className="w-32" />
        <span className="w-8 text-right text-sm tabular-nums text-dim">{cs.muted ? 0 : cs.volume}</span>
      </div>
    </div>
  );
}
