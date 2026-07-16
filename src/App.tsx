import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout 
} from './firebase';
import { 
  fetchSpreadsheetTitle, 
  fetchSpreadsheetReports, 
  extractSpreadsheetId 
} from './sheetsService';
import { SheetReport } from './types';
import ApartmentCards from './components/ApartmentCards';
import NotificationCenter from './components/NotificationCenter';
import CleanerReminder from './components/CleanerReminder';
import ApartmentWifi from './components/ApartmentWifi';
import ApartmentCheckIn from './components/ApartmentCheckIn';
import DataManagement from './components/DataManagement';
import AccessBoundary from './components/AccessBoundary';
import { NetworkStatus } from './components/PWAControls';
import { useApartmentData } from './data/ApartmentDataProvider';
import { publicUrl } from './utils/publicUrl';
import { useUiLanguage } from './i18n';
import { 
  RefreshCw, 
  AlertTriangle, 
  ExternalLink, 
  LogOut, 
  Sparkles, 
  Settings2, 
  Database,
  Grid,
  BellRing,
  Building2,
  Smartphone,
  UserCheck,
  UserCog,
  Wifi,
  Key,
  ArrowDown,
  ArrowUp,
  Sun,
  Moon
} from 'lucide-react';

const DEFAULT_SPREADSHEET_ID = '1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE';
const SNAPSHOT_KEY = 'inventory_cached_snapshot_v2';

interface CachedSnapshot {
  title: string;
  reports: SheetReport[];
  syncedAt: string;
}

type ActiveTab = 'apartments' | 'notifications' | 'remind-cleaner' | 'wifi' | 'checkin' | 'manage';

function readCachedSnapshot(): CachedSnapshot | null {
  try {
    const cached = localStorage.getItem(SNAPSHOT_KEY);
    return cached ? JSON.parse(cached) as CachedSnapshot : null;
  } catch {
    return null;
  }
}

export default function App() {
  const cachedSnapshot = readCachedSnapshot();
  const { canEdit, role } = useApartmentData();
  const { language, setLanguage, text } = useUiLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme_dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme_dark', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = darkMode ? '#0f172a' : '#ffffff';
  }, [darkMode]);

  // Sheets data states
  const [spreadsheetInput, setSpreadsheetInput] = useState(() => {
    return localStorage.getItem('google_sheet_id_input') || DEFAULT_SPREADSHEET_ID;
  });
  const [spreadsheetTitle, setSpreadsheetTitle] = useState(cachedSnapshot?.title || '—');
  const [reports, setReports] = useState<SheetReport[]>(cachedSnapshot?.reports || []);
  const [lastSyncedAt, setLastSyncedAt] = useState(cachedSnapshot?.syncedAt || '');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  
  // Custom shortage thresholds state
  const [shortageTermsInput, setShortageTermsInput] = useState(() => {
    return localStorage.getItem('inventory_shortage_terms') || 'low, empty, 0, shortage, out';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return ['apartments', 'notifications', 'remind-cleaner', 'wifi', 'checkin', 'manage'].includes(requestedTab || '')
      ? requestedTab as ActiveTab
      : 'apartments';
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url);
  }, [activeTab]);

  // Floating Scroll button detection
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down');

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      
      // Only show top/bottom floating scroll button if document height is bigger than window with some margin
      if (docHeight - winHeight > 250) {
        setShowScrollBottom(true);
      } else {
        setShowScrollBottom(false);
      }

      // If we are past the middle of the page, arrow goes up, otherwise down
      if (scrollY > (docHeight - winHeight) * 0.45) {
        setScrollDirection('up');
      } else {
        setScrollDirection('down');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    
    // Initial check
    const timer = setTimeout(handleScroll, 600);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timer);
    };
  }, [reports, activeTab]);

  const handleScrollToggle = () => {
    if (scrollDirection === 'down') {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (gUser, gToken) => {
        setUser(gUser);
        setToken(gToken);
        setAuthInitializing(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthInitializing(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setApiError('');
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      setApiError(err?.message || 'Google login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleClearCache = () => {
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem('google_sheet_id_input');
    localStorage.removeItem('inventory_shortage_terms');
    setReports([]);
    setSpreadsheetTitle('—');
    setLastSyncedAt('');
    setApiError('');
  };

  // Main fetch function wrapped in useCallback to stabilize dependencies
  const handleLoadData = useCallback(async (forcedToken?: string) => {
    const cleanId = extractSpreadsheetId(spreadsheetInput.trim());
    if (!cleanId) {
      setApiError('Please provide a valid Google Sheets URL or Spreadsheet ID.');
      return;
    }

    setLoading(true);
    setApiError('');
    
    // Save to local storage for persistence
    try {
      localStorage.setItem('google_sheet_id_input', spreadsheetInput.trim());
      localStorage.setItem('inventory_shortage_terms', shortageTermsInput);
    } catch {
      // Private browsing modes may disable storage; syncing should still continue.
    }

    const activeToken = forcedToken || token;
    if (!activeToken) {
      setApiError(
        'Sign in with Google to securely refresh inventory data. Any saved snapshot remains available offline.'
      );
      setLoading(false);
      return;
    }

    try {
      // Fetch spreadsheet title
      const title = await fetchSpreadsheetTitle(cleanId, activeToken);
      setSpreadsheetTitle(title);

      // Fetch sheet reports
      const termsArray = shortageTermsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      
      const parsedReports = await fetchSpreadsheetReports(cleanId, activeToken, termsArray);
      setReports(parsedReports);
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ title, reports: parsedReports, syncedAt } satisfies CachedSnapshot));
      } catch {
        console.warn('Inventory synced, but the offline snapshot could not be saved on this device.');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || '';
      const isAuthError = errMsg.toLowerCase().includes('authentication') || 
                          errMsg.toLowerCase().includes('credential') || 
                          errMsg.toLowerCase().includes('token') ||
                          errMsg.toLowerCase().includes('http 401') ||
                          errMsg.toLowerCase().includes('unauthorized') ||
                          errMsg.toLowerCase().includes('401');

      if (isAuthError) {
        setToken(null);
        setUser(null);
        setApiError('Your Google login session has expired or is invalid. Please sign in again to continue syncing Google Sheets data.');
      } else {
        setApiError(
          errMsg || 'An error occurred while fetching Sheets data. Please verify your link and sharing permissions.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [spreadsheetInput, shortageTermsInput, token]);

  // Refresh after a user explicitly grants a Sheets token.
  useEffect(() => {
    if (token) void handleLoadData(token);
  }, [token, handleLoadData]);

  // Count total low stock products
  const totalLowProductCount = reports.reduce((sum, r) => sum + r.lowItems.length, 0);
  const totalAlertApartments = reports.filter(r => r.hasLowStock).length;

  const currentSheetId = extractSpreadsheetId(spreadsheetInput.trim());

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between selection:bg-indigo-500/30 transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50/50 text-slate-800'
    }`}>
      {/* 1. Header Area - Extremely streamlined and compact on mobile */}
      <header className={`border-b sticky top-0 z-40 transition-colors duration-200 ${
        darkMode ? 'bg-slate-900 border-slate-800 shadow-md' : 'bg-white border-slate-100 shadow-xs'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4 flex flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden shadow-md shadow-indigo-500/20 border border-slate-200/20 dark:border-slate-800 shrink-0">
              <img src={publicUrl('logo.jpg')} alt="Apartment Control Center Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-xs sm:text-lg font-bold font-display tracking-tight flex items-center gap-1.5 leading-none truncate ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}>
                {text('Quản lý căn hộ', 'Apartment Inventory')} <span className={`hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-semibold border font-sans ${
                  darkMode ? 'bg-indigo-950/50 text-indigo-300 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>v3.0.6 PWA</span>
              </h1>
              <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate hidden sm:block ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>{text('Theo dõi tồn kho, Wi-Fi và hướng dẫn nhận phòng', 'Aggregate status and dispatch alerts')}</p>
            </div>
          </div>

          {/* Right side Header buttons */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" aria-label={text('Chọn ngôn ngữ', 'Choose language')}>
              <button type="button" onClick={() => setLanguage('vi')} title="Tiếng Việt" aria-label="Tiếng Việt" className={`rounded-lg px-2 py-1.5 text-sm transition ${language === 'vi' ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600' : 'opacity-45 hover:opacity-100'}`}>🇻🇳</button>
              <button type="button" onClick={() => setLanguage('en')} title="English" aria-label="English" className={`rounded-lg px-2 py-1.5 text-sm transition ${language === 'en' ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600' : 'opacity-45 hover:opacity-100'}`}>🇬🇧</button>
            </div>
            {/* Dark Mode toggle button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              id="theme-toggle"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`p-2 rounded-xl transition duration-200 cursor-pointer border flex items-center justify-center focus:outline-none ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700 hover:text-amber-300' 
                  : 'bg-slate-50 border-slate-200 text-indigo-600 hover:bg-slate-100 hover:text-indigo-800'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
            </button>

            {/* User Auth block - Space efficient profiling */}
            {user ? (
              <div className={`flex items-center gap-2 sm:gap-3 border rounded-lg sm:rounded-xl p-1 sm:p-1.5 sm:pl-3 shrink-0 transition ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="text-right hidden sm:block">
                  <span className={`text-xs font-semibold block max-w-[120px] truncate ${
                    darkMode ? 'text-slate-200' : 'text-slate-700'
                  }`}>{user.displayName || user.email}</span>
                  <span className="text-[9px] text-emerald-400 font-mono flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : 'Authorizing'}
                  </span>
                </div>
                
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Avatar" 
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg object-cover border ${
                      darkMode ? 'border-slate-700' : 'border-slate-200'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center ${
                    darkMode ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  id="btn-logout"
                  title="Logout"
                  className={`p-1 sm:p-2 rounded-md sm:rounded-lg transition ${
                    darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-550/10 active:scale-95 transition cursor-pointer shrink-0"
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span>{isLoggingIn ? 'Syncing...' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <NetworkStatus />

      {/* 2. Main Content Wrapper */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-8 flex-1 w-full space-y-4 sm:space-y-6">
        
        {authInitializing ? (
          <div className="py-20 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-xs font-semibold">Verifying secure Google session...</p>
          </div>
        ) : (
          <AccessBoundary onLogin={() => void handleLogin()} onLogout={() => void handleLogout()} isLoggingIn={isLoggingIn}>
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
            
            {/* 4. Three column key status boards (Render only for sheets-dependent tabs if reports are loaded) */}
            {['apartments', 'notifications', 'remind-cleaner'].includes(activeTab) && reports.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-2.5 sm:p-3 rounded-xl border transition-colors duration-200 flex items-center gap-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800 shadow-sm' : 'bg-white border-slate-100 shadow-xs'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    darkMode ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block leading-none">Total Apartments</span>
                    <span className={`text-sm sm:text-base font-bold font-display mt-0.5 block leading-tight ${
                      darkMode ? 'text-white' : 'text-slate-800'
                    }`}>{reports.length} Units</span>
                  </div>
                </div>

                <div className={`p-2.5 sm:p-3 rounded-xl border transition-colors duration-200 flex items-center gap-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800 shadow-sm' : 'bg-white border-slate-100 shadow-xs'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    darkMode ? 'bg-rose-950/60 text-rose-400' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block leading-none">Shortages</span>
                    <span className={`text-sm sm:text-base font-bold font-display mt-0.5 block leading-tight ${
                      darkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {totalAlertApartments} / {reports.length} Units
                    </span>
                  </div>
                </div>

                <div className={`p-2.5 sm:p-3 rounded-xl border transition-colors duration-200 flex items-center gap-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800 shadow-sm' : 'bg-white border-slate-100 shadow-xs'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    darkMode ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block leading-none">Restock Items</span>
                    <span className={`text-sm sm:text-base font-bold font-display mt-0.5 block leading-tight ${
                      darkMode ? 'text-white' : 'text-slate-800'
                    }`}>{totalLowProductCount} Items</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Sub Navigation tabs - Always visible to ensure instant access */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[11px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 ${
                  darkMode ? 'text-indigo-400' : 'text-indigo-700'
                }`}>
                  <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                  {text('Mục quản lý chính', 'Main management')}
                </span>
              </div>
              <div className={`p-3 rounded-2xl border-2 transition-all duration-200 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-3 ${
                darkMode 
                  ? 'bg-slate-950 border-indigo-500 shadow-xl shadow-indigo-950/80' 
                  : 'bg-indigo-50 border-2 border-indigo-600 shadow-lg shadow-indigo-200/50'
              }`}>
                <button
                  onClick={() => setActiveTab('apartments')}
                  id="tab-apartments"
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                    activeTab === 'apartments'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-500 shadow-md shadow-indigo-500/20 scale-[1.03]'
                      : darkMode
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <Grid className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === 'apartments' ? 'text-white' : 'text-indigo-500 dark:text-indigo-450'
                  }`} />
                  <span className="truncate">
                    <span className="inline md:hidden">Inventory</span>
                    <span className="hidden md:inline">Apartment Inventory Layout</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setActiveTab('notifications')}
                  id="tab-notifications"
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                    activeTab === 'notifications'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-500 shadow-md shadow-rose-500/20 scale-[1.03]'
                      : darkMode
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <BellRing className={`w-4 h-4 shrink-0 transition-colors animate-bounce-short ${
                    activeTab === 'notifications' ? 'text-white' : 'text-rose-500 dark:text-rose-450'
                  }`} />
                  <span className="truncate flex items-center gap-1.5 justify-center">
                    <span className="inline md:hidden">Alerts</span>
                    <span className="hidden md:inline">Notification & Push Alerts</span>
                    {totalAlertApartments > 0 && (
                      <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-full ${
                        activeTab === 'notifications'
                          ? 'bg-white text-rose-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {totalAlertApartments}
                      </span>
                    )}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('remind-cleaner')}
                  id="tab-remind-cleaner"
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                    activeTab === 'remind-cleaner'
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.03]'
                      : darkMode
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === 'remind-cleaner' ? 'text-white' : 'text-emerald-500 dark:text-emerald-450'
                  }`} />
                  <span className="truncate">
                    <span className="inline md:hidden">Cleaner</span>
                    <span className="hidden md:inline">Remind Cleaner</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('wifi')}
                  id="tab-wifi"
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                    activeTab === 'wifi'
                      ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white border-sky-500 shadow-md shadow-sky-500/20 scale-[1.03]'
                      : darkMode
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <Wifi className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === 'wifi' ? 'text-white' : 'text-sky-500 dark:text-sky-450'
                  }`} />
                  <span className="truncate">
                    <span className="inline md:hidden">WiFi</span>
                    <span className="hidden md:inline">Apartment WiFi</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('checkin')}
                  id="tab-checkin"
                  className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                    activeTab === 'checkin'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-450 shadow-md shadow-amber-500/20 scale-[1.03]'
                      : darkMode
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <Key className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === 'checkin' ? 'text-white' : 'text-amber-500 dark:text-amber-450'
                  }`} />
                  <span className="truncate">
                    <span className="inline md:hidden">Check-In</span>
                    <span className="hidden md:inline">Apartment Check-In</span>
                  </span>
                </button>

                {canEdit && (
                  <button
                    onClick={() => setActiveTab('manage')}
                    id="tab-manage"
                    className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer border select-none focus:outline-none active:scale-95 shadow-xs ${
                      activeTab === 'manage'
                        ? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white border-violet-500 shadow-md shadow-violet-500/20 scale-[1.03]'
                        : darkMode
                          ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 shadow-sm'
                    }`}
                  >
                    <UserCog className={`w-4 h-4 shrink-0 transition-colors ${activeTab === 'manage' ? 'text-white' : 'text-violet-500'}`} />
                    <span className="truncate">
                      <span className="inline md:hidden">Manage</span>
                      <span className="hidden md:inline">Manage Data & Access</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* 6. Active Tab layout */}
            <div className="pt-2 animate-in fade-in-30 zoom-in-95 duration-200">
              {['apartments', 'notifications', 'remind-cleaner'].includes(activeTab) ? (
                loading && reports.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-500 text-sm">Loading room layouts and active stock inventory...</p>
                  </div>
                ) : reports.length > 0 ? (
                  activeTab === 'apartments' ? (
                    <ApartmentCards reports={reports} shortageTerms={shortageTermsInput.split(',')} />
                  ) : activeTab === 'notifications' ? (
                    <NotificationCenter reports={reports} />
                  ) : (
                    <CleanerReminder reports={reports} />
                  )
                ) : (
                  /* EMPTY DEFAULT STATE / GOOGLE LOGIN INSIDE SHEETS DEPENDENT TABS */
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-slate-800 font-bold text-sm tracking-tight">Data Source Configuration (Google Sheets)</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                        {/* Spreadsheet Link or ID */}
                        <div className="lg:col-span-6 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-slate-700 text-xs font-bold block" htmlFor="spreadsheet-id-input">
                              Google Sheets URL or Spreadsheet ID:
                            </label>
                            <button
                              onClick={() => setSpreadsheetInput(DEFAULT_SPREADSHEET_ID)}
                              className="text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold transition bg-transparent border-none cursor-pointer"
                            >
                              Use Demo Sheet
                            </button>
                          </div>
                          <input
                            id="spreadsheet-id-input"
                            type="text"
                            className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl text-[16px] md:text-xs outline-none transition duration-150"
                            placeholder="Paste your link or sheet ID here..."
                            value={spreadsheetInput}
                            onChange={(e) => setSpreadsheetInput(e.target.value)}
                          />
                        </div>

                        {/* Comma shortage terms parameters */}
                        <div className="lg:col-span-3 space-y-1.5">
                          <label className="text-slate-700 text-xs font-bold block" htmlFor="shortage-terms-input">
                            Low Stock Keywords (Comma-Separated):
                          </label>
                          <input
                            id="shortage-terms-input"
                            type="text"
                            className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl text-[16px] md:text-xs outline-none transition duration-150"
                            placeholder="Separated by commas"
                            value={shortageTermsInput}
                            onChange={(e) => setShortageTermsInput(e.target.value)}
                          />
                        </div>

                        {/* Submit trigger load buttons */}
                        <div className="lg:col-span-3 flex gap-2">
                          <button
                            onClick={() => handleLoadData()}
                            id="btn-sync-data"
                            disabled={loading}
                            className="flex-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 transition flex items-center justify-center gap-1.5 cursor-pointer h-[42px]"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Syncing...' : 'Sync Data'}
                          </button>
                        </div>
                      </div>

                      {apiError && (() => {
                        const isAuthErr = !token || 
                          apiError.toLowerCase().includes('authentication') || 
                          apiError.toLowerCase().includes('credential') || 
                          apiError.toLowerCase().includes('token') || 
                          apiError.toLowerCase().includes('log in') || 
                          apiError.toLowerCase().includes('unauthorized') || 
                          apiError.toLowerCase().includes('expired');
                        return (
                          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
                            <div className="flex items-start gap-2">
                              <span className="text-rose-500 text-base mt-0.5">⚠️</span>
                              <div className="space-y-0.5">
                                <p className="font-bold text-rose-950">
                                  {isAuthErr
                                    ? 'Google Sheets Access or Login Required'
                                    : 'Data synchronization error:'}
                                </p>
                                <p className="text-[11px] text-rose-700 leading-relaxed">{apiError}</p>
                              </div>
                            </div>
                            
                            {isAuthErr && (
                              <div className="flex flex-wrap gap-1.5 shrink-0 w-full md:w-auto md:justify-end">
                                <button
                                  onClick={handleLogin}
                                  disabled={isLoggingIn}
                                  className="flex-1 md:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition cursor-pointer shrink-0"
                                >
                                  {isLoggingIn ? 'Connecting...' : '🔑 Sign In / Reconnect'}
                                </button>
                                <button
                                  onClick={handleClearCache}
                                  className="flex-1 md:flex-none px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-xl transition cursor-pointer shrink-0"
                                >
                                  🧹 Clear Cache & Reset
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-xs flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 scale-102">
                        <Database className="w-8 h-8 text-indigo-500" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base font-display">Google Sheets Access Required</h3>
                      <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed">
                        Sign in with Google to sync active inventory logs and automatically highlight low stock items.
                      </p>
                      
                      {!token ? (
                        <div className="mt-5 flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center">
                          <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 transition flex items-center justify-center gap-2 border-0 cursor-pointer"
                          >
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 block shrink-0">
                              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            </svg>
                            <span>{isLoggingIn ? 'Connecting...' : 'Sign In with Google'}</span>
                          </button>
                          <button
                            onClick={handleClearCache}
                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition border-0 cursor-pointer"
                          >
                            🧹 Clear Cache
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleLoadData()}
                          className="mt-5 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border-0 hover:scale-102 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Sync Now
                        </button>
                      )}
                    </div>

                    {/* Mobile / Stuck Help Panel */}
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-left space-y-3 shadow-xs max-w-2xl mx-auto">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                        <Smartphone className="w-4 h-4 shrink-0 animate-bounce" />
                        <span>Gặp Lỗi Đăng Nhập Trên Điện Thoại? / Stuck on Mobile?</span>
                      </div>
                      
                      <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                        <p>
                          🇻🇳 <strong>Lưu ý:</strong> Khi mở app từ liên kết trong ứng dụng khác (như Airbnb, Zalo, Messenger), hoặc sử dụng Safari trên iOS, tính năng mở cửa sổ đăng nhập Google thường bị chặn hoặc dính cache cũ làm kẹt màn hình.
                        </p>
                        <p>
                          🇬🇧 <strong>Note:</strong> If you open this app via an in-app browser (e.g. within Airbnb, Zalo, Messenger) or iOS Safari, Google's login pop-up might be blocked or cached, causing a freeze.
                        </p>
                      </div>

                      <div className="pt-1.5 flex flex-col gap-2">
                        <button
                          onClick={() => void handleLogout()}
                          id="btn-force-clear-cache"
                          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2.5 border border-slate-700 active:scale-95 transition cursor-pointer shadow-md"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <div className="flex flex-col items-center text-center leading-normal">
                            <span className="text-xs font-extrabold tracking-wide">Đặt Lại Phiên Đăng Nhập Google</span>
                            <span className="text-[10px] font-bold opacity-85 mt-0.5 uppercase tracking-wider">Reset Google Session</span>
                          </div>
                        </button>
                        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium">
                          💡 Mẹo: Mở liên kết bằng <strong>Safari chuẩn</strong> (iOS) hoặc <strong>Chrome chuẩn</strong> (Android), không đăng nhập trong trình duyệt của Zalo/Messenger/Airbnb.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                activeTab === 'wifi' ? (
                  <ApartmentWifi />
                ) : activeTab === 'checkin' ? (
                  <ApartmentCheckIn />
                ) : (
                  <DataManagement />
                )
              )}
            </div>

            {/* 7. Collapsible Data Source Configuration at the very bottom (only for sheets dependent tabs if reports are loaded) */}
            {['apartments', 'notifications', 'remind-cleaner'].includes(activeTab) && reports.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-xs mt-4">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full flex items-center justify-between text-left hover:text-indigo-600 transition focus:outline-none bg-transparent border-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-indigo-600" />
                    <span className="text-slate-800 font-bold text-xs sm:text-sm tracking-tight">Data Source Configuration (Google Sheets Tracker)</span>
                    {spreadsheetTitle !== '—' && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-750 font-semibold px-2 py-0.5 rounded-full border border-emerald-100 animate-fade-in">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Connected
                      </span>
                    )}
                  </div>
                  <span className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 shrink-0">
                    {showSettings ? "Collapse ▲" : "Configure & Sync Data ⚙️"}
                  </span>
                </button>

                {showSettings && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
                      {/* Spreadsheet Link or ID */}
                      <div className="lg:col-span-6 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-700 text-xs font-bold block" htmlFor="spreadsheet-id-input">
                            Google Sheets URL or Spreadsheet ID:
                          </label>
                          <button
                            onClick={() => setSpreadsheetInput(DEFAULT_SPREADSHEET_ID)}
                            className="text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold transition bg-transparent border-none cursor-pointer"
                          >
                            Use Demo Sheet
                          </button>
                        </div>
                        <input
                          id="spreadsheet-id-input"
                          type="text"
                          className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl text-[16px] md:text-xs outline-none transition duration-150"
                          placeholder="Paste your link or sheet ID here..."
                          value={spreadsheetInput}
                          onChange={(e) => setSpreadsheetInput(e.target.value)}
                        />
                      </div>

                      {/* Comma shortage terms parameters */}
                      <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-slate-700 text-xs font-bold block" htmlFor="shortage-terms-input">
                          Low Stock Keywords (Comma-Separated):
                        </label>
                        <input
                          id="shortage-terms-input"
                          type="text"
                          className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 rounded-xl text-[16px] md:text-xs outline-none transition duration-150"
                          placeholder="Separated by commas"
                          value={shortageTermsInput}
                          onChange={(e) => setShortageTermsInput(e.target.value)}
                        />
                      </div>

                      {/* Submit trigger load buttons */}
                      <div className="lg:col-span-3 flex gap-2">
                        <button
                          onClick={() => handleLoadData()}
                          id="btn-sync-data"
                          disabled={loading}
                          className="flex-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 transition flex items-center justify-center gap-1.5 cursor-pointer h-[42px]"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                          {loading ? 'Syncing...' : 'Sync Data'}
                        </button>
                      </div>
                    </div>

                    {spreadsheetTitle !== '—' && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600 gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-800">Connected</span>
                          <span className="text-slate-400">|</span>
                          <span className="truncate text-slate-700 italic font-medium">"{spreadsheetTitle}"</span>
                        </div>
                        
                        {currentSheetId && (
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${currentSheetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 font-semibold"
                          >
                            Open Google Sheets
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {apiError && (() => {
                      const isAuthErr = !token || 
                        apiError.toLowerCase().includes('authentication') || 
                        apiError.toLowerCase().includes('credential') || 
                        apiError.toLowerCase().includes('token') || 
                        apiError.toLowerCase().includes('log in') || 
                        apiError.toLowerCase().includes('unauthorized') || 
                        apiError.toLowerCase().includes('expired');
                      return (
                        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in duration-200">
                          <div className="flex items-start gap-2">
                            <span className="text-rose-500 text-base mt-0.5">⚠️</span>
                            <div className="space-y-0.5">
                              <p className="font-bold text-rose-950">
                                {isAuthErr
                                  ? 'Google Sheets Access or Login Required'
                                  : 'Data synchronization error:'}
                              </p>
                              <p className="text-[11px] text-rose-700 leading-relaxed">{apiError}</p>
                            </div>
                          </div>
                          
                          {isAuthErr && (
                            <div className="flex flex-wrap gap-1.5 shrink-0 w-full md:w-auto md:justify-end">
                              <button
                                onClick={handleLogin}
                                disabled={isLoggingIn}
                                className="flex-1 md:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition cursor-pointer shrink-0"
                              >
                                {isLoggingIn ? 'Connecting...' : '🔑 Sign In / Reconnect'}
                              </button>
                              <button
                                onClick={handleClearCache}
                                className="flex-1 md:flex-none px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-xl transition cursor-pointer shrink-0"
                              >
                                🧹 Clear Cache & Reset
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          </AccessBoundary>
        )}
      </main>

      {/* 3. Footer Area */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Apartment Inventory Tracker · Installable secure PWA</p>
          <div className="flex gap-4">
            <span className="hover:text-indigo-600">
              {lastSyncedAt ? `Last sync: ${new Date(lastSyncedAt).toLocaleString()}` : 'No inventory sync yet'}
            </span>
            <span>•</span>
            <span className="hover:text-indigo-600 font-semibold flex items-center gap-0.5">
              Firebase access control
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Scroll Button */}
      {showScrollBottom && (
        <div id="floating-scroll-bar" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <button
            onClick={handleScrollToggle}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl hover:shadow-indigo-200/50 pl-3 md:pl-4 pr-3 py-3 rounded-full hover:scale-105 active:scale-95 border-0 font-bold text-xs transition-all duration-200 cursor-pointer"
          >
            <span className="text-[11px] font-semibold text-white/95 tracking-wide shrink-0">
              {scrollDirection === 'down' ? 'Scroll Down' : 'Scroll Up'}
            </span>
            {scrollDirection === 'down' ? (
              <ArrowDown className="w-3.5 h-3.5 text-white animate-pulse" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
