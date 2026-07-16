import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Search,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { useApartmentData } from '../data/ApartmentDataProvider';

type CopyType = 'all' | 'ssid' | 'password';

export default function ApartmentWifi() {
  const { data } = useApartmentData();
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const wifiRecords = data?.wifi ?? [];

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return wifiRecords;
    return wifiRecords.filter(record =>
      [record.apartment, record.wifiName, record.note]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, wifiRecords]);

  const copy = async (recordId: string, text: string, type: CopyType) => {
    await navigator.clipboard.writeText(text);
    const key = `${recordId}:${type}`;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(current => current === key ? '' : current), 1800);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                <Wifi className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">Apartment Wi-Fi</h2>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{wifiRecords.length} network profiles</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search apartment or Wi-Fi name…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950 md:text-xs"
              />
            </label>
          </div>
        </div>
      </section>

      {filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          No apartment matches “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecords.map(record => {
            const completeText = `Apartment: ${record.apartment}\nWi-Fi: ${record.wifiName || 'Not available'}\nPassword: ${record.password || 'Not available'}${record.note ? `\nNote: ${record.note}` : ''}`;
            return (
              <article key={record.id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-indigo-500">Apartment</p>
                    <h3 className="mt-1 text-xs font-extrabold leading-5 text-slate-800 dark:text-slate-100">{record.apartment}</h3>
                  </div>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                </div>

                <div className="space-y-3 p-4">
                  <CredentialRow
                    label="Wi-Fi name"
                    value={record.wifiName || 'Not available'}
                    copied={copiedKey === `${record.id}:ssid`}
                    onCopy={() => void copy(record.id, record.wifiName || '', 'ssid')}
                  />
                  <CredentialRow
                    label="Password"
                    value={record.password || 'Not available'}
                    copied={copiedKey === `${record.id}:password`}
                    onCopy={() => void copy(record.id, record.password || '', 'password')}
                  />

                  {record.note && (
                    <p className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-[10px] leading-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                      {record.note}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void copy(record.id, completeText, 'all')}
                    className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[10px] font-extrabold transition ${
                      copiedKey === `${record.id}:all`
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900'
                    }`}
                  >
                    {copiedKey === `${record.id}:all` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === `${record.id}:all` ? 'Copied' : 'Copy full Wi-Fi message'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 truncate font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        disabled={!value || value === 'Not available'}
        className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : label === 'Password' ? <KeyRound className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
