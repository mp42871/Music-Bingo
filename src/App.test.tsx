import { render, screen } from '@testing-library/react';
import App from './App';

test('renders settings route and main nav', async () => {
  window.location.hash = '#/settings';
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
  for (const name of ['Play', 'Playlists', 'Cards', 'Check', 'History', 'Settings']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument();
  }
});
