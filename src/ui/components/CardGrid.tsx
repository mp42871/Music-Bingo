import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { cleanTitle } from '../../core/io';
import { resolveColors } from '../../core/style';
import type { Card, CardLayout, Cell, PrintStyle, Song } from '../../core/types';
import { QR } from './QR';
import '../card.css';

export const cardNo = (n: number) => `#${String(n).padStart(4, '0')}`;

function cellText(cell: Cell, layout: CardLayout, songs: Map<string, Song>): { main: string; sub?: string; art?: string } {
  if (cell.kind === 'free') return { main: layout.freeText || 'FREE' };
  if (cell.kind === 'artist') return { main: cell.artist };
  const s = songs.get(cell.songId);
  if (!s) return { main: '?' };
  const title = s.displayTitle ?? cleanTitle(s.title);
  if (layout.cellContent === 'artist') return { main: s.artist, art: s.artUrl };
  if (layout.cellContent === 'both') return { main: title, sub: s.artist, art: s.artUrl };
  return { main: title, art: s.artUrl };
}

/** Pick a font size (container units) that fits text into a cell without breaking words. */
export function fitSize(text: string, size: number, sub = false, display = false): string {
  const base = { 3: 5.4, 4: 4.2, 5: 3.4 }[size as 3 | 4 | 5];
  const len = text.length;
  const scale = len <= 10 ? 1.15 : len <= 18 ? 1 : len <= 28 ? 0.86 : len <= 40 ? 0.74 : 0.62;
  const cellW = (92 - (size - 1)) / size;
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  const wordCap = (cellW * 0.86) / (longest * (display ? 0.8 : 0.62));
  return `${Math.min(base * scale * (sub ? 0.78 : 1), wordCap).toFixed(2)}cqmin`;
}

/** Shrink the text in any cell whose words still spill out (fonts and phone sizes vary). */
export function shrinkToFit(root: HTMLElement) {
  for (const cell of root.querySelectorAll<HTMLElement>('.bc-cell, .bc-head')) {
    const spans = [...cell.querySelectorAll<HTMLElement>(':scope > span')];
    const parts = spans.length ? spans : [cell];
    // React writes the planned size; anything else there is our own shrink from last time.
    for (const el of parts) {
      if (el.style.fontSize !== el.dataset.shrunk) el.dataset.fs = el.style.fontSize;
      if (el.dataset.fs) el.style.fontSize = el.dataset.fs;
      delete el.dataset.shrunk;
    }
    const over = () => cell.scrollHeight > cell.clientHeight + 1 || cell.scrollWidth > cell.clientWidth + 1;
    for (let k = 0.9; k > 0.35 && over(); k *= 0.9) {
      for (const el of parts) {
        const m = /^([\d.]+)([a-z%]+)$/.exec(el.dataset.fs ?? '');
        if (!m) continue;
        el.style.fontSize = `${(Number(m[1]) * k).toFixed(2)}${m[2]}`;
        el.dataset.shrunk = el.style.fontSize;
      }
    }
  }
}

export function CardGrid({ card, layout, songsById, style, marked, highlightMask, uncalled, onToggle, showQr, className = '' }: {
  card: Card; layout: CardLayout; songsById: Map<string, Song>; style: PrintStyle;
  marked?: boolean[]; highlightMask?: number[] | null; uncalled?: boolean[];
  onToggle?: (i: number) => void; showQr?: boolean; className?: string;
}) {
  const n = layout.size;
  const c = resolveColors(style);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    shrinkToFit(el);
    let raf = 0;
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => shrinkToFit(el)); };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(again);
    ro?.observe(el);
    void document.fonts?.ready.then(again);
    return () => { ro?.disconnect(); cancelAnimationFrame(raf); };
  });
  const vars = {
    '--c-bg': c.bg, '--c-ink': c.ink, '--c-accent': c.accent, '--c-accent2': c.accent2,
    '--c-cell': c.cell, '--c-line': c.line, '--c-head-ink': c.headerInk, '--c-font': c.font,
  } as CSSProperties;
  const corners = new Set([0, n - 1, n * (n - 1), n * n - 1]);
  const hl = new Set(highlightMask ?? []);
  const headSize = { 3: 5, 4: 4, 5: 3.3 }[n];

  const headers: string[] =
    layout.headerMode === 'letters' ? [...(layout.letters || 'BINGO').padEnd(n, ' ').slice(0, n)]
      : layout.headerMode === 'categories' ? Array.from({ length: n }, (_, i) => layout.columnCategories[i] ?? '')
        : [];

  return (
    <div ref={ref} className={`bingo-card ${className}`} style={vars} data-card={card.number}>
      <div className="bc-top">
        {style.logoDataUrl && <img src={style.logoDataUrl} alt="" className="bc-logo" />}
        <div className="min-w-0">
          <div className="bc-title">{style.title || 'Music Bingo'}</div>
          {style.subtitle && <div className="bc-sub">{style.subtitle}</div>}
        </div>
        <div className="bc-num">{cardNo(card.number)}</div>
        {showQr && <QR text={String(card.number)} className="bc-qr" />}
      </div>
      <div className="bc-grid" role="grid" aria-label={`Bingo card ${cardNo(card.number)}`}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${n}, minmax(0, 1fr))` }}>
        <div role="row" className="contents">
          {layout.headerMode === 'theme'
            ? <div role="columnheader" className="bc-head bc-banner" style={{ fontSize: `${headSize * 1.2}cqmin` }}>{layout.themeCategory || layout.themeLabel || 'Music Bingo'}</div>
            : headers.map((h, i) => (
              <div role="columnheader" key={i} className="bc-head" style={{ fontSize: layout.headerMode === 'letters' ? `${headSize * 1.9}cqmin` : fitSize(h, n, false, true) }}>
                {style.mysteryColumn === i ? <span>?</span> : h}
              </div>
            ))}
        </div>
        {Array.from({ length: n }, (_, r) => (
          <div role="row" className="contents" key={r}>
            {Array.from({ length: n }, (_, col) => {
              const i = r * n + col;
              const cell = card.cells[i];
              const t = cellText(cell, layout, songsById);
              const free = cell.kind === 'free';
              const art = style.showArt && !free && t.art;
              const cls = `bc-cell ${free ? 'bc-free' : ''} ${art ? 'bc-art' : ''} ${style.bonusCorners && corners.has(i) && !free ? 'bc-bonus' : ''}`;
              const props = {
                role: 'gridcell', className: cls,
                'data-marked': marked ? String(!!marked[i]) : undefined,
                'data-hl': hl.has(i) ? 'true' : undefined,
                'data-uncalled': uncalled?.[i] ? 'true' : undefined,
                style: art ? { backgroundImage: `url(${t.art})` } : undefined,
              };
              const inner = free && style.theme === 'vinyl'
                ? <span className="bc-disc" style={{ fontSize: fitSize(t.main, n, true) }}>{t.main}</span>
                : (<>
                  <span style={{ fontSize: fitSize(t.main, n) }}>{t.main}</span>
                  {t.sub && <span className="bc-artist" style={{ fontSize: fitSize(t.sub, n, true) }}>{t.sub}</span>}
                </>);
              return onToggle
                ? <button type="button" key={i} {...props} aria-pressed={!!marked?.[i]} onClick={() => onToggle(i)}>{inner}</button>
                : <div key={i} {...props}>{inner}</div>;
            })}
          </div>
        ))}
      </div>
      {style.bonusCorners && <div className="bc-foot"><span>★ Corner songs win a bonus prize</span><span /></div>}
    </div>
  );
}
