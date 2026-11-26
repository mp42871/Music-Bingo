import { buildSearchQuery, type SearchFilters } from '../spotify/query';

export const PRESET_GROUPS = ['Decades', 'Genres', 'Occasions', 'Themes'] as const;
export type PresetGroup = (typeof PRESET_GROUPS)[number];

export interface Preset {
  id: string; name: string; group: PresetGroup;
  /** One search with filters… */
  query?: SearchFilters;
  /** …or several Spotify searches mixed together. */
  queries?: string[];
}

const dec = (id: string, name: string, from: number, to: number): Preset => ({ id, name, group: 'Decades', query: { yearFrom: from, yearTo: to } });
const gen = (id: string, name: string, genre: string, years?: [number, number]): Preset =>
  ({ id, name, group: 'Genres', query: { genre, ...(years ? { yearFrom: years[0], yearTo: years[1] } : {}) } });
const words = (id: string, name: string, group: PresetGroup, list: string[]): Preset => ({ id, name, group, queries: list.map((w) => `track:"${w}"`) });
const text = (id: string, name: string, group: PresetGroup, list: string[]): Preset => ({ id, name, group, queries: list });

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

  text('christmas', 'Christmas', 'Occasions', ['christmas', 'track:"christmas"', 'holiday', 'jingle']),
  text('halloween', 'Halloween', 'Occasions', ['halloween', 'track:"monster"', 'track:"ghost"', 'spooky']),
  text('wedding', 'Wedding', 'Occasions', ['wedding', 'track:"love"', 'first dance', 'track:"forever"']),
  text('summer', 'Summer', 'Occasions', ['track:"summer"', 'track:"sun"', 'beach', 'track:"surf"']),
  text('roadtrip', 'Road Trip', 'Occasions', ['road trip', 'track:"highway"', 'track:"drive"', 'track:"road"']),
  text('workout', 'Workout', 'Occasions', ['workout', 'track:"run"', 'pump up', 'track:"stronger"']),
  text('july4', '4th of July', 'Occasions', ['track:"america"', 'track:"usa"', 'track:"freedom"', 'track:"fireworks"']),
  text('stpats', 'St. Patrick’s Day', 'Occasions', ['irish', 'track:"irish"', 'celtic', 'track:"whiskey"']),
  text('valentines', 'Valentine’s Day', 'Occasions', ['track:"love"', 'track:"heart"', 'love songs', 'track:"kiss"']),
  text('newyear', 'New Year’s Eve', 'Occasions', ['track:"tonight"', 'track:"party"', 'celebration', 'track:"new year"']),
  text('birthday', 'Birthday Party', 'Occasions', ['birthday', 'track:"birthday"', 'track:"party"', 'track:"celebrate"']),
  text('office', 'Office Party', 'Occasions', ['track:"work"', 'track:"9 to 5"', 'track:"money"', 'track:"boss"']),

  words('colors', 'Colors in the Title', 'Themes', ['red', 'blue', 'yellow', 'black', 'white', 'green', 'purple', 'pink', 'gold']),
  words('numbers', 'Numbers in the Title', 'Themes', ['one', 'two', 'three', 'five', 'seven', 'nine', '99', 'hundred']),
  words('places', 'Places in the Title', 'Themes', ['california', 'new york', 'texas', 'london', 'paris', 'memphis', 'tennessee', 'hollywood']),
  words('names', 'Names in the Title', 'Themes', ['jolene', 'roxanne', 'billie', 'jessie', 'layla', 'gloria', 'mickey', 'angie']),
  words('weather', 'Weather', 'Themes', ['rain', 'sunshine', 'storm', 'thunder', 'snow', 'wind', 'cloud']),
  words('animals', 'Animals', 'Themes', ['dog', 'cat', 'tiger', 'bird', 'horse', 'wolf', 'eagle', 'monkey']),
  words('food', 'Food & Drink', 'Themes', ['sugar', 'cherry', 'candy', 'whiskey', 'tequila', 'coffee', 'peach', 'honey']),
  words('cars', 'Cars & Driving', 'Themes', ['car', 'cadillac', 'drive', 'highway', 'truck', 'little red corvette']),
  words('night', 'Night & Day', 'Themes', ['night', 'tonight', 'midnight', 'morning', 'sunday', 'friday', 'saturday']),
  words('dance', 'Songs About Dancing', 'Themes', ['dance', 'dancing', 'shake', 'move', 'boogie', 'groove']),
  text('onehit', 'One-Hit Wonders', 'Themes', ['one hit wonder', 'one hit wonders 80s', 'one hit wonders 90s']),
  text('movies', 'Movie Soundtracks', 'Themes', ['soundtrack', 'from the motion picture', 'movie theme']),
  text('tv', 'TV Theme Songs', 'Themes', ['tv theme', 'theme from', 'theme song']),
  text('boybands', 'Boy Bands', 'Themes', ['genre:"boy band"', 'boy band']),
  text('divas', 'Divas', 'Themes', ['artist:"whitney houston"', 'artist:"mariah carey"', 'artist:"celine dion"', 'artist:"madonna"', 'artist:"beyonce"', 'artist:"adele"']),
  text('duets', 'Duets', 'Themes', ['duet', 'feat.', 'with']),
  text('karaoke', 'Karaoke Classics', 'Themes', ['karaoke classics', 'sing along', 'singalong']),
  text('anthems', 'Stadium Anthems', 'Themes', ['anthem', 'stadium anthems', 'track:"rock"']),
  text('covers', 'Famous Covers', 'Themes', ['cover', 'covers']),
  text('kids', '90s Kids', 'Themes', ['year:1995-2002 genre:"pop"', 'year:1995-2002 genre:"boy band"']),
];

export function presetQueries(p: Preset): string[] {
  return p.query ? [buildSearchQuery(p.query)] : p.queries ?? [];
}
