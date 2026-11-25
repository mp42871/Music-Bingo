import type { PrintStyle, PrintTheme } from './types';

export interface ThemeDef {
  id: PrintTheme; name: string;
  bg: string; ink: string; accent: string; accent2: string; cell: string; line: string;
  headerInk: string; font: string; inkSaverBg: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'neon', name: 'Neon club', bg: '#120b2a', ink: '#f4efff', accent: '#2de2ff', accent2: '#ff3ea5', cell: '#1d1442', line: '#3a2f6e', headerInk: '#0b0618', font: "'Bungee', sans-serif", inkSaverBg: '#ffffff' },
  { id: 'vinyl', name: 'Retro vinyl', bg: '#f3e9d6', ink: '#1b1410', accent: '#d9481c', accent2: '#1b1410', cell: '#fbf5ea', line: '#1b1410', headerInk: '#fbf5ea', font: "'Bungee', sans-serif", inkSaverBg: '#ffffff' },
  { id: 'minimal', name: 'Clean minimal', bg: '#ffffff', ink: '#111111', accent: '#111111', accent2: '#7a7a7a', cell: '#ffffff', line: '#111111', headerInk: '#ffffff', font: "'Sora', sans-serif", inkSaverBg: '#ffffff' },
  { id: 'cassette', name: 'Cassette', bg: '#efe3c8', ink: '#2a2420', accent: '#1f8a8a', accent2: '#e86f2c', cell: '#f8f0dd', line: '#2a2420', headerInk: '#f8f0dd', font: "'Bungee', sans-serif", inkSaverBg: '#ffffff' },
  { id: 'festival', name: 'Festival', bg: '#fff7e8', ink: '#2b0b3a', accent: '#ff3e8a', accent2: '#ffb000', cell: '#ffffff', line: '#2b0b3a', headerInk: '#ffffff', font: "'Bungee', sans-serif", inkSaverBg: '#ffffff' },
  { id: 'holiday', name: 'Holiday', bg: '#fbf6ef', ink: '#1d2b1f', accent: '#b3122e', accent2: '#1f6b3a', cell: '#ffffff', line: '#1d2b1f', headerInk: '#ffffff', font: "'Bungee', sans-serif", inkSaverBg: '#ffffff' },
];

export const themeById = (id: PrintTheme) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const DEFAULT_STYLE: PrintStyle = {
  theme: 'neon', accent: '', background: '', inkSaver: false, paper: 'letter', perPage: 2,
  title: 'Music Bingo', subtitle: '', cutLines: true, showArt: false, bonusCorners: false, mysteryColumn: null,
};

/** Resolves the colors a card should use for a style. */
export function resolveColors(style: PrintStyle) {
  const t = themeById(style.theme);
  const inkSaver = style.inkSaver;
  const darkTheme = t.id === 'neon';
  return {
    font: t.font,
    accent: style.accent || t.accent,
    accent2: t.accent2,
    bg: style.background || (inkSaver ? t.inkSaverBg : t.bg),
    cell: inkSaver ? '#ffffff' : t.cell,
    ink: inkSaver && darkTheme ? '#111111' : t.ink,
    line: inkSaver && darkTheme ? '#111111' : t.line,
    headerInk: inkSaver ? '#ffffff' : t.headerInk,
  };
}
