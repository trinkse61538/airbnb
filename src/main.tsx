import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApartmentDataProvider } from './data/ApartmentDataProvider.tsx';
import { registerPWA } from './pwa.ts';
import { LanguageProvider } from './i18n.tsx';
import ParkingExtension from './components/ParkingExtension.tsx';
import SafeGuideSelectionGuard from './components/SafeGuideSelectionGuard.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ApartmentDataProvider>
        <App />
        <ParkingExtension />
        <SafeGuideSelectionGuard />
      </ApartmentDataProvider>
    </LanguageProvider>
  </StrictMode>,
);

registerPWA();
