import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SecureDataProvider } from './secure/SecureDataProvider.tsx';
import { registerPWA } from './pwa.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecureDataProvider>
      <App />
    </SecureDataProvider>
  </StrictMode>,
);

registerPWA();
