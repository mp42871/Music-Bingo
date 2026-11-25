export interface Preset {
  id: string; name: string;
  query: { text?: string; yearFrom?: number; yearTo?: number; genre?: string };
}

export const PRESETS: Preset[] = [
  { id: '60s', name: '60s', query: { yearFrom: 1960, yearTo: 1969 } },
  { id: '70s', name: '70s', query: { yearFrom: 1970, yearTo: 1979 } },
  { id: '80s', name: '80s', query: { yearFrom: 1980, yearTo: 1989 } },
  { id: '90s', name: '90s', query: { yearFrom: 1990, yearTo: 1999 } },
  { id: '2000s', name: '2000s', query: { yearFrom: 2000, yearTo: 2009 } },
  { id: '2010s', name: '2010s', query: { yearFrom: 2010, yearTo: 2019 } },
  { id: '2020s', name: '2020s', query: { yearFrom: 2020, yearTo: 2029 } },
  { id: 'country', name: 'Top Country', query: { genre: 'country' } },
  { id: '80srock', name: '80s Rock', query: { genre: 'rock', yearFrom: 1980, yearTo: 1989 } },
  { id: '90shiphop', name: '90s Hip-Hop', query: { genre: 'hip-hop', yearFrom: 1990, yearTo: 1999 } },
  { id: 'disco', name: 'Disco', query: { genre: 'disco' } },
  { id: 'motown', name: 'Motown & Soul', query: { genre: 'soul', yearFrom: 1960, yearTo: 1979 } },
  { id: 'boybands', name: 'Boy Bands', query: { genre: 'boy band' } },
  { id: 'onehit', name: 'One-Hit Wonders', query: { text: 'one hit wonder' } },
  { id: 'movies', name: 'Movie Soundtracks', query: { genre: 'soundtrack' } },
  { id: 'christmas', name: 'Christmas', query: { text: 'christmas' } },
  { id: 'party', name: 'Party Anthems', query: { genre: 'dance pop' } },
  { id: 'yacht', name: 'Yacht Rock', query: { genre: 'yacht rock' } },
  { id: 'emo', name: 'Emo & Pop-Punk', query: { genre: 'pop punk' } },
  { id: 'latin', name: 'Latin', query: { genre: 'latin' } },
  { id: 'grunge', name: '90s Alternative', query: { genre: 'alternative rock', yearFrom: 1990, yearTo: 1999 } },
  { id: 'classicrock', name: 'Classic Rock', query: { genre: 'classic rock' } },
];
