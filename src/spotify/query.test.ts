import { buildSearchQuery, parsePlaylistId } from './query';

test('buildSearchQuery', () => {
  expect(buildSearchQuery({ text: 'love', yearFrom: 1980, yearTo: 1989, genre: 'country' })).toBe('love year:1980-1989 genre:"country"');
  expect(buildSearchQuery({ yearFrom: 1990 })).toBe('year:1990');
  expect(buildSearchQuery({ genre: 'hip-hop' })).toBe('genre:"hip-hop"');
  expect(buildSearchQuery({ text: '  ' })).toBe('');
});
test('parsePlaylistId', () => {
  expect(parsePlaylistId('https://open.spotify.com/playlist/37i9dQZF1DX4UtSsGT1Sbe?si=abc')).toBe('37i9dQZF1DX4UtSsGT1Sbe');
  expect(parsePlaylistId('spotify:playlist:37i9dQZF1DX4UtSsGT1Sbe')).toBe('37i9dQZF1DX4UtSsGT1Sbe');
  expect(parsePlaylistId('37i9dQZF1DX4UtSsGT1Sbe')).toBe('37i9dQZF1DX4UtSsGT1Sbe');
  expect(parsePlaylistId('hello world')).toBeNull();
});

test('field search: title, artist, album, genre and years combine', () => {
  expect(buildSearchQuery({ track: 'Jolene', artist: 'Dolly Parton' })).toBe('track:"Jolene" artist:"Dolly Parton"');
  expect(buildSearchQuery({ album: 'Rumours' })).toBe('album:"Rumours"');
  expect(buildSearchQuery({ text: 'live', artist: 'Queen', yearFrom: 1985, yearTo: 1986, genre: 'rock' })).toBe('live artist:"Queen" year:1985-1986 genre:"rock"');
  expect(buildSearchQuery({ artist: 'Guns N" Roses' })).toBe('artist:"Guns N Roses"');
});
