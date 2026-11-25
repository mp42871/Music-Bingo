import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useSpotify } from './app/spotifyStore';
import { Nav } from './ui/components/Nav';
import Home from './ui/pages/Home';
import Pools from './ui/pages/Pools';
import PoolEditor from './ui/pages/PoolEditor';
import Designer from './ui/pages/Designer';
import Print from './ui/pages/Print';
import Console from './ui/pages/Console';
import Audience from './ui/pages/Audience';
import Check from './ui/pages/Check';
import History from './ui/pages/History';
import Settings from './ui/pages/Settings';
import Phone from './ui/pages/Phone';

const BARE = ['/audience', '/phone', '/print'];

function Shell() {
  const loc = useLocation();
  const bare = BARE.some((p) => loc.pathname.startsWith(p));
  return (
    <>
      {!bare && <Nav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pools" element={<Pools />} />
        <Route path="/pools/:id" element={<PoolEditor />} />
        <Route path="/designer" element={<Designer />} />
        <Route path="/print/:setId" element={<Print />} />
        <Route path="/console/:gameId" element={<Console />} />
        <Route path="/audience" element={<Audience />} />
        <Route path="/check" element={<Check />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/phone" element={<Phone />} />
      </Routes>
    </>
  );
}

export default function App() {
  useEffect(() => { void useSpotify.getState().init(); }, []);
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
