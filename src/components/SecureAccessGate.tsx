import { FormEvent, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useSecureData } from '../secure/SecureDataProvider';

export default function SecureAccessGate() {
  const { status, error, unlock } = useSecureData();
  const [passphrase, setPassphrase] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const unlocked = await unlock(passphrase, remember);
    if (unlocked) setPassphrase('');
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-100/70 blur-3xl dark:bg-indigo-950/60" />
      <div className="relative mx-auto grid max-w-4xl gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
            Protected apartment vault
          </p>
          <h2 className="mt-2 max-w-xl text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Enter the access key to view Wi-Fi and check-in details
          </h2>
          <p className="mt-3 max-w-xl text-xs leading-6 text-slate-500 dark:text-slate-400">
            Passwords, lockbox codes and entry photos are encrypted before they are uploaded to GitHub. Decryption happens only on this device.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> AES-256 encryption
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-950">
              <KeyRound className="h-3 w-3" /> Session-only access
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/70 sm:p-5">
          <label htmlFor="vault-passphrase" className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Private access key
          </label>
          <div className="relative mt-2">
            <input
              id="vault-passphrase"
              type={showKey ? 'text' : 'password'}
              autoComplete="current-password"
              value={passphrase}
              onChange={event => setPassphrase(event.target.value)}
              placeholder="Enter access key"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-base text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-950"
            />
            <button
              type="button"
              onClick={() => setShowKey(value => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={showKey ? 'Hide access key' : 'Show access key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={event => setRemember(event.target.checked)}
              className="mt-0.5 accent-indigo-600"
            />
            Keep unlocked until this browser session ends
          </label>

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!passphrase.trim() || status === 'unlocking'}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-extrabold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'unlocking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {status === 'unlocking' ? 'Opening protected data…' : 'Unlock apartment vault'}
          </button>
        </form>
      </div>
    </section>
  );
}

