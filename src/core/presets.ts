import { buildSearchQuery, type SearchFilters } from '../spotify/query';
import { CURATED } from './curatedLists';

export const PRESET_GROUPS = ['Decades', 'Genres', 'Occasions', 'Themes'] as const;
export type PresetGroup = (typeof PRESET_GROUPS)[number];

export interface Preset {
  id: string; name: string; group: PresetGroup;
  /** One search with filters… */
  query?: SearchFilters;
  /** …or several Spotify searches mixed together… */
  queries?: string[];
  /** …or a hand-picked list ("Artist - Title" per line) looked up song by song. */
  songs?: string;
}

const dec = (id: string, name: string, from: number, to: number): Preset => ({ id, name, group: 'Decades', query: { yearFrom: from, yearTo: to } });
const gen = (id: string, name: string, genre: string, years?: [number, number]): Preset =>
  ({ id, name, group: 'Genres', query: { genre, ...(years ? { yearFrom: years[0], yearTo: years[1] } : {}) } });
const picked = (id: string, name: string, group: PresetGroup): Preset => ({ id, name, group, songs: CURATED[id] });

export const PRESETS: Preset[] = [
  dec('50s', '50s', 1950, 1959), dec('60s', '60s', 1960, 1969), dec('70s', '70s', 1970, 1979), dec('80s', '80s', 1980, 1989),
  dec('90s', '90s', 1990, 1999), dec('2000s', '2000s', 2000, 2009), dec('2010s', '2010s', 2010, 2019), dec('2020s', '2020s', 2020, 2029),
  dec('early80s', 'Early 80s', 1980, 1984), dec('late80s', 'Late 80s', 1985, 1989), dec('early90s', 'Early 90s', 1990, 1994),
  dec('late90s', 'Late 90s', 1995, 1999), dec('y2k', 'Y2K (1998–2003)', 1998, 2003), dec('2005-2015', '2005–2015', 2005, 2015),

  gen('country', 'Top Country', 'country'), gen('90scountry', '90s Country', 'country', [1990, 1999]), gen('newcountry', 'New Country', 'country', [2015, 2029]),
  gen('classicrock', 'Classic Rock', 'classic rock'), gen('80srock', '80s Rock', 'rock', [1980, 1989]), gen('hairmetal', 'Hair Metal', 'glam metal'),
  gen('altrock', '90s Alternative', 'alternative rock', [1990, 1999]), gen('grunge', 'Grunge', 'grunge'), gen('punk', 'Pop Punk & Emo', 'pop punk'),
  gen('indie', 'Indie', 'indie rock'), gen('pop', 'Pop Hits', 'pop'), gen('dancepop', 'Dance Pop', 'dance pop'),
  gen('hiphop', 'Hip-Hop', 'hip hop'), gen('90shiphop', '90s Hip-Hop', 'hip hop', [1990, 1999]), gen('rnb', 'R&B', 'r&b'),
  gen('90srnb', '90s R&B', 'r&b', [1990, 1999]), gen('soul', 'Soul', 'soul'), gen('motown', 'Motown', 'motown'),
  gen('funk', 'Funk', 'funk'), gen('disco', 'Disco', 'disco'), gen('newwave', 'New Wave', 'new wave'),
  gen('synthpop', 'Synth-Pop', 'synthpop'), gen('edm', 'EDM', 'edm'), gen('house', 'House', 'house'),
  gen('reggae', 'Reggae', 'reggae'), gen('latin', 'Latin', 'latin'), gen('reggaeton', 'Reggaeton', 'reggaeton'),
  gen('kpop', 'K-Pop', 'k-pop'), gen('yacht', 'Yacht Rock', 'yacht rock'), gen('folk', 'Folk', 'folk'),
  gen('blues', 'Blues', 'blues'), gen('jazz', 'Jazz Standards', 'jazz'), gen('gospel', 'Gospel', 'gospel'),
  gen('broadway', 'Broadway', 'show tunes'), gen('metal', 'Metal', 'metal'), gen('ska', 'Ska', 'ska'),

  picked('christmas', 'Christmas', 'Occasions'),
  picked('halloween', 'Halloween', 'Occasions'),
  picked('wedding', 'Wedding', 'Occasions'),
  picked('summer', 'Summer', 'Occasions'),
  picked('roadtrip', 'Road Trip', 'Occasions'),
  picked('workout', 'Workout', 'Occasions'),
  picked('july4', '4th of July', 'Occasions'),
  picked('stpats', 'St. Patrick’s Day', 'Occasions'),
  picked('valentines', 'Valentine’s Day', 'Occasions'),
  picked('newyear', 'New Year’s Eve', 'Occasions'),
  picked('birthday', 'Birthday Party', 'Occasions'),
  picked('office', 'Office Party', 'Occasions'),

  picked('colors', 'Colors in the Title', 'Themes'),
  picked('numbers', 'Numbers in the Title', 'Themes'),
  picked('places', 'Places in the Title', 'Themes'),
  picked('names', 'Names in the Title', 'Themes'),
  picked('weather', 'Weather', 'Themes'),
  picked('animals', 'Animals', 'Themes'),
  picked('food', 'Food & Drink', 'Themes'),
  picked('cars', 'Cars & Driving', 'Themes'),
  picked('night', 'Night & Day', 'Themes'),
  picked('dance', 'Songs About Dancing', 'Themes'),
  picked('onehit', 'One-Hit Wonders', 'Themes'),
  picked('movies', 'Movie Soundtracks', 'Themes'),
  picked('tv', 'TV Theme Songs', 'Themes'),
  picked('boybands', 'Boy Bands', 'Themes'),
  picked('divas', 'Divas', 'Themes'),
  picked('duets', 'Duets', 'Themes'),
  picked('karaoke', 'Karaoke Classics', 'Themes'),
  picked('anthems', 'Stadium Anthems', 'Themes'),
  picked('covers', 'Famous Covers', 'Themes'),
  picked('kids', '90s Kids', 'Themes'),
];

export function presetQueries(p: Preset): string[] {
  return p.query ? [buildSearchQuery(p.query)] : p.queries ?? [];
}
