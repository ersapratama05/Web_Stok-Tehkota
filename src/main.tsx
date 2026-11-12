import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-reload upon new update
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[Teh Kota PWA] New version detected, reloading to apply updates...');
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[Teh Kota PWA] App ready to work offline');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

