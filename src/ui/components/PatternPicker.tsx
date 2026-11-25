import { masksFor } from '../../core/patterns';

/** Shows a pattern's shape; for 'custom', lets the host click cells to draw it. */
export function PatternPicker({ size, patternId, mask, onMask }: { size: 3 | 4 | 5; patternId: string; mask?: number[]; onMask?: (m: number[]) => void }) {
  const custom = patternId === 'custom';
  const shown = new Set(custom ? mask ?? [] : masksFor(patternId, size)[0]);
  const many = !custom && masksFor(patternId, size).length > 1;
  return (
    <div className="flex items-center gap-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, 1.4rem)` }} aria-label="Pattern shape">
        {Array.from({ length: size * size }, (_, i) => (
          <button key={i} type="button" disabled={!custom} aria-label={`Cell ${i + 1}`} aria-pressed={shown.has(i)}
            onClick={() => onMask?.(shown.has(i) ? [...shown].filter((x) => x !== i) : [...shown, i])}
            className={`size-[1.4rem] rounded ${shown.has(i) ? 'bg-deck-b' : 'bg-rail'} ${custom ? 'cursor-pointer hover:outline hover:outline-deck-a' : ''}`} />
        ))}
      </div>
      <span className="text-xs text-dim">{custom ? 'Click squares to draw the pattern.' : many ? 'One example — any matching line counts.' : ''}</span>
    </div>
  );
}
