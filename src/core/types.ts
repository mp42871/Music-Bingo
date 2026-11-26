export interface Song {
  id: string; uri: string; title: string; artist: string; album: string;
  year?: number; durationMs: number; artUrl?: string; displayTitle?: string;
  startMs?: number; categories: string[]; excluded?: boolean;
  /** Linked music file in this browser's library (offline playback). */
  fileId?: string;
  /** Spotify playlists this song was imported from (songs added by hand have none). */
  sourceIds?: string[];
}
export interface Pool {
  id: string; name: string; songs: Song[]; categories: string[];
  createdAt: number; updatedAt: number;
  /** Spotify playlists this bingo playlist was imported from (for "Update from Spotify"). */
  sources?: { id: string; name: string }[];
}
export type HeaderMode = 'categories' | 'theme' | 'letters';
export type CellContent = 'title' | 'artist' | 'both' | 'artistBingo';
export interface CardLayout {
  size: 3 | 4 | 5; freeCenter: boolean; freeText: string;
  headerMode: HeaderMode; columnCategories: string[];
  /** Theme category; empty = the whole playlist. */
  themeCategory?: string;
  /** Banner text for a whole-playlist theme (the playlist name). */
  themeLabel?: string;
  letters: string; cellContent: CellContent;
}
export type Cell =
  | { kind: 'song'; songId: string }
  | { kind: 'artist'; artist: string }
  | { kind: 'free' };
/** Cells are row-major, length size*size. */
export interface Card { number: number; cells: Cell[] }
export interface CardSet {
  id: string; name: string; poolId: string; seed: number; layout: CardLayout;
  cards: Card[]; createdAt: number;
  /** Snapshot of the pool's songs when the cards were made (so reprints/checks never drift). */
  songs?: Song[];
  style?: PrintStyle;
  /** All playlists the cards were made from (when more than one). */
  poolIds?: string[];
}
export interface PatternDef { id: string; name: string }
export interface Call { songId: string; at: number }
export interface Winner { cardNumber: number; name?: string; prize?: string; atCall: number }
export interface Round {
  patternId: string; customMask?: number[]; winners: Winner[];
  startCall: number; endCall?: number;
}
export interface ClipSettings {
  clipSec: number; gapSec: number;
  startMode: 'beginning' | 'fixed' | 'random' | 'marker';
  fixedStartSec: number; randomMinSec: number; randomMaxSec: number;
  autoAdvance: boolean; fadeSec: number; hideTitles: boolean;
  /** Where music comes from: Spotify when possible, your files first, or you play it yourself. */
  source: 'auto' | 'files' | 'manual';
}
export type PrintTheme = 'neon' | 'vinyl' | 'minimal' | 'cassette' | 'festival' | 'holiday';
export interface PrintStyle {
  theme: PrintTheme; accent: string; background: string; inkSaver: boolean;
  paper: 'letter' | 'a4'; perPage: 1 | 2 | 4 | 6;
  title: string; subtitle: string; logoDataUrl?: string; cutLines: boolean;
  showArt: boolean; bonusCorners: boolean; mysteryColumn: number | null;
}
export interface Game {
  id: string; name: string; createdAt: number; pool: Pool; cardSetId: string;
  settings: ClipSettings; callOrder: string[]; calls: Call[]; rounds: Round[];
  status: 'setup' | 'live' | 'finished';
  /** When the call order was last saved as a Spotify playlist (for manual offline play). */
  orderSavedAt?: number;
}
export interface AudioFile {
  id: string; name: string; title: string; artist: string; album?: string;
  durationMs: number; size: number; type: string; addedAt: number;
}
