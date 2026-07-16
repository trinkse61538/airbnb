import type { ReactNode } from 'react';
import { AlertTriangle, Database, KeyRound, Loader2, LogOut, ShieldX } from 'lucide-react';
import { useApartmentData } from '../data/ApartmentDataProvider';

export default function AccessBoundary({
  children,
  onLogin,
  onLogout,
  isLoggingIn,
}: {
  children: ReactNode;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
}) {
  const { status, user, error } = useApartmentData();

  if (status === 'ready') return <>{children}</>;

  if (status === 'signed-out') {
    return (
      <div className="mx-auto max-w-lg py-10 sm:py-20">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><KeyRound className="h-6 w-6" /></span>
          <h2 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">Apartment Control Center</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">Đăng nhập bằng tài khoản đã được Admin cấp quyền để xem và quản lý dữ liệu căn hộ.</p>
          <button type="button" onClick={onLogin} disabled={isLoggingIn} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-extrabold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:opacity-50">
            {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isLoggingIn ? 'Connecting…' : 'Sign in with Google'}
          </button>
          <p className="mt-3 text-[9px] text-slate-400">Tài khoản Hotmail có thể dùng nút này nếu đã đăng ký làm Google Account.</p>
        </div>
      </div>
    );
  }

  if (status === 'checking-access' || status === 'loading') {
    return (
      <div className="py-24 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Checking account access and loading apartment data…</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="mx-auto max-w-lg py-10 sm:py-20">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
          <ShieldX className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">Tài khoản chưa được cấp quyền</h2>
          <p className="mt-2 text-xs text-slate-500">{user?.email || 'This account'} chưa có trong danh sách người dùng. Hãy liên hệ {`khaitri15@gmail.com`}.</p>
          <button type="button" onClick={onLogout} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-extrabold text-slate-600 dark:border-slate-700 dark:text-slate-300"><LogOut className="h-4 w-4" /> Use another account</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20 sm:p-6">
        <div className="flex items-start gap-3">
          {error.includes('Firestore') ? <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
          <div>
            <h2 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">Firebase database setup required</h2>
            <p className="mt-2 text-xs leading-5 text-amber-800 dark:text-amber-300">{error || 'Unable to load Firebase data.'}</p>
            <p className="mt-3 text-[10px] leading-5 text-amber-700 dark:text-amber-400">Create Cloud Firestore and Cloud Storage, publish the included rules, then reload this page.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-xl bg-amber-600 px-4 text-[10px] font-extrabold text-white">Reload app</button>
              <button type="button" onClick={onLogout} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 px-4 text-[10px] font-extrabold text-amber-800 dark:border-amber-800 dark:text-amber-300"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

