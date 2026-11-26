import { THEMES } from '../../core/style';
import type { CardLayout, PrintStyle } from '../../core/types';
import { Field } from './Field';

/** Title, theme, colors, logo, paper and extras for printed cards. */
export function StyleControls({ style, onChange, layout }: { style: PrintStyle; onChange: (s: PrintStyle) => void; layout: CardLayout }) {
  const st = <K extends keyof PrintStyle>(k: K, v: PrintStyle[K]) => onChange({ ...style, [k]: v });
  return (
    <>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {THEMES.map((t) => (
        <button key={t.id} type="button" aria-pressed={style.theme === t.id} onClick={() => st('theme', t.id)}
          className={`flex items-center gap-3 rounded-xl border p-2.5 text-left ${style.theme === t.id ? 'border-deck-b' : 'border-rail hover:border-dim'}`}>
          <span className="flex h-8 w-12 overflow-hidden rounded" style={{ background: t.bg }}>
            <span className="m-1 w-3 rounded-sm" style={{ background: t.accent }} /><span className="my-1 w-3 rounded-sm" style={{ background: t.accent2 }} />
          </span>
          <span className="text-sm font-semibold">{t.name}</span>
        </button>
      ))}
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Title"><input value={style.title} onChange={(e) => st('title', e.target.value)} /></Field>
      <Field label="Subtitle (event, date, charity…)"><input value={style.subtitle} onChange={(e) => st('subtitle', e.target.value)} /></Field>
      <Field label="Accent color">
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Accent color" value={style.accent || '#2de2ff'} onChange={(e) => st('accent', e.target.value)} className="h-9 w-14 p-1" />
          {style.accent && <button type="button" className="text-xs text-dim underline" onClick={() => st('accent', '')}>theme default</button>}
        </div>
      </Field>
      <Field label="Background color">
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Background color" value={style.background || '#ffffff'} onChange={(e) => st('background', e.target.value)} className="h-9 w-14 p-1" />
          {style.background && <button type="button" className="text-xs text-dim underline" onClick={() => st('background', '')}>theme default</button>}
        </div>
      </Field>
      <Field label="Logo (optional)">
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" aria-label="Logo" onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => st('logoDataUrl', String(r.result));
            r.readAsDataURL(f);
          }} />
          {style.logoDataUrl && <button type="button" className="text-xs text-dim underline" onClick={() => st('logoDataUrl', undefined)}>remove</button>}
        </div>
      </Field>
      <Field label="Paper and layout">
        <div className="flex gap-2">
          <select aria-label="Paper size" value={style.paper} onChange={(e) => st('paper', e.target.value as PrintStyle['paper'])}>
            <option value="letter">US Letter</option><option value="a4">A4</option>
          </select>
          <select aria-label="Cards per page" value={style.perPage} onChange={(e) => st('perPage', Number(e.target.value) as PrintStyle['perPage'])}>
            <option value={1}>1 per page</option><option value={2}>2 per page</option><option value={4}>4 per page</option><option value={6}>6 per page</option>
          </select>
        </div>
      </Field>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={style.inkSaver} onChange={(e) => st('inkSaver', e.target.checked)} /> Ink saver (white background)</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={style.cutLines} onChange={(e) => st('cutLines', e.target.checked)} /> Cut lines</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={style.showArt} onChange={(e) => st('showArt', e.target.checked)} /> Album art squares</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={style.bonusCorners} onChange={(e) => st('bonusCorners', e.target.checked)} /> Bonus corners ★</label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={style.mysteryColumn !== null} disabled={layout.headerMode !== 'categories'}
          onChange={(e) => st('mysteryColumn', e.target.checked ? layout.size - 1 : null)} /> Mystery column
        {style.mysteryColumn !== null && (
          <select aria-label="Mystery column" value={style.mysteryColumn} onChange={(e) => st('mysteryColumn', Number(e.target.value))}>
            {Array.from({ length: layout.size }, (_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
          </select>
        )}
      </label>
    </div>
    </>
  );
}
