import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {injectSpeedInsights} from '@vercel/speed-insights';

// Cleanup old legacy test indexedDB caches
if (typeof window !== 'undefined') {
  try {
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      for (let i = 1; i <= 10; i++) {
        window.indexedDB.deleteDatabase(`ArrozApitStorage_v${i}`);
      }
      window.indexedDB.deleteDatabase('ArrozApitStorage_v8_clean');
      window.indexedDB.deleteDatabase('ArrozApitStorage_v9_clean');
      window.indexedDB.deleteDatabase('ArrozApitStorage_v10_prod');
    }
  } catch {
    // ignore
  }
}

import './utils/localDB';
import App from './App.tsx';
import './index.css';

// Initialize Vercel Speed Insights
injectSpeedInsights();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
