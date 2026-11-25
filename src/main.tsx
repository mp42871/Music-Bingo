import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bungee/400.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import './index.css';
import { requestPersistentStorage } from './app/online';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void requestPersistentStorage();
