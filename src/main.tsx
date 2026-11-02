import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {injectSpeedInsights} from '@vercel/speed-insights';

// Purge any lingering test data or legacy queues for 100% clean production launch
if (typeof window !== 'undefined' && window.localStorage) {
  const prodFlag = 'apit_zero_state_reset_v11_clean_prod';
  if (window.localStorage.getItem(prodFlag) !== 'true') {
    try {
      window.localStorage.clear();
      window.localStorage.setItem(prodFlag, 'true');
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
