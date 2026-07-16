import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApartmentDataProvider } from './data/ApartmentDataProvider.tsx';
import { registerPWA } from './pwa.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApartmentDataProvider>
      <App />
    </ApartmentDataProvider>
  </StrictMode>,
);

registerPWA();
