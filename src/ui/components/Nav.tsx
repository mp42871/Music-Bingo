import { NavLink } from 'react-router-dom';
import { useOnline } from '../../app/online';

const LINKS = [
  { to: '/', label: 'Play', end: true },
  { to: '/pools', label: 'Playlists' },
  { to: '/designer', label: 'Cards' },
  { to: '/check', label: 'Check' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

export function Nav() {
  const online = useOnline();
  return (
    <header className="sticky top-0 z-30 border-b border-rail bg-night/85 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="font-display text-xl tracking-wide">
          <span className="text-deck-a glow-a">Music</span> <span className="text-deck-b glow-b">Bingo</span>
        </NavLink>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-booth-2 text-deck-a' : 'text-dim hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <span className={`chip ml-auto ${online ? 'text-ok' : 'border-peak text-peak'}`} role="status" title={online ? 'Connected to the internet' : 'No internet — your saved playlists, cards and music files still work'}>
          <span className={`size-2 rounded-full ${online ? 'bg-ok' : 'bg-peak'}`} />{online ? 'Online' : 'Offline'}
        </span>
      </div>
    </header>
  );
}
