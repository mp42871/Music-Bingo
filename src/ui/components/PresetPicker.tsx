import { useState } from 'react';
import { PRESET_GROUPS, PRESETS, type Preset, type PresetGroup } from '../../core/presets';

/** Grouped quick categories. `mode="pick"` = one-click buttons; `mode="multi"` = checkboxes. */
export function PresetPicker({ mode, selected = [], onPick, disabled }: {
  mode: 'pick' | 'multi'; selected?: string[]; onPick(p: Preset): void; disabled?: boolean;
}) {
  const [group, setGroup] = useState<PresetGroup>('Decades');
  return (
    <div>
      <div role="tablist" aria-label="Category groups" className="mb-2 flex flex-wrap gap-1">
        {PRESET_GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {g}{mode === 'multi' && PRESETS.some((p) => p.group === g && selected.includes(p.id)) ? ' •' : ''}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => p.group === group).map((p) => mode === 'pick' ? (
          <button key={p.id} type="button" className="chip hover:border-deck-a" disabled={disabled} onClick={() => onPick(p)}>{p.name}</button>
        ) : (
          <label key={p.id} className={`chip cursor-pointer ${selected.includes(p.id) ? 'border-deck-b text-deck-b' : ''}`}>
            <input type="checkbox" className="sr-only" aria-label={p.name} checked={selected.includes(p.id)} disabled={disabled} onChange={() => onPick(p)} />
            {selected.includes(p.id) ? '✓ ' : ''}{p.name}
          </label>
        ))}
      </div>
    </div>
  );
}
