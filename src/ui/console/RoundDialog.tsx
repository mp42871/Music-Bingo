import { useState } from 'react';
import { PATTERNS } from '../../core/patterns';
import { PatternPicker } from '../components/PatternPicker';

export function RoundDialog({ round, size, onStart, onFinish, onClose }: {
  round: number; size: 3 | 4 | 5; onStart(patternId: string, mask?: number[]): void; onFinish(): void; onClose(): void;
}) {
  const [pattern, setPattern] = useState('twoLines');
  const [mask, setMask] = useState<number[]>([]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Next round" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="panel w-full max-w-md p-5">
        <h2 className="mb-4 text-xl font-bold">Round {round} is over</h2>
        <label className="flex flex-col gap-1">
          <span className="label">Pattern</span>
          <select aria-label="Pattern" value={pattern} onChange={(e) => setPattern(e.target.value)}>
            {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="mt-3"><PatternPicker size={size} patternId={pattern} mask={mask} onMask={setMask} /></div>
        <p className="mt-3 text-sm text-dim">Keep the same cards and keep playing — songs already called still count.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" onClick={onFinish}>End game</button>
          <button type="button" className="btn btn-b" onClick={() => onStart(pattern, pattern === 'custom' ? mask : undefined)}>Start round {round + 1}</button>
        </div>
      </div>
    </div>
  );
}
