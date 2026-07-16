import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  MapPin,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { useApartmentData } from '../data/ApartmentDataProvider';
import { CheckInPhoto } from '../secure/types';

type Language = 'vi' | 'en' | 'bilingual';

export default function ApartmentCheckIn() {
  const { data } = useApartmentData();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('');
  const [language, setLanguage] = useState<Language>('bilingual');
  const [copiedKey, setCopiedKey] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<CheckInPhoto | null>(null);
  const [sharingPhoto, setSharingPhoto] = useState('');
  const records = data?.checkin ?? [];

  useEffect(() => {
    if (!activeId && records[0]) setActiveId(records[0].id);
  }, [activeId, records]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPhoto(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedPhoto]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return records;
    return records.filter(record =>
      [record.apartment, record.keyAddress, record.lockboxType]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [query, records]);

  const activeRecord = records.find(record => record.id === activeId) || records[0];
  const viSteps = activeRecord ? data?.instructionsVi[activeRecord.id] ?? [] : [];
  const enSteps = activeRecord ? data?.instructionsEn[activeRecord.id] ?? [] : [];
  const displayedSteps = buildSteps(language, viSteps, enSteps);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(current => current === key ? '' : current), 1800);
  };

  const sharePhoto = async (photo: CheckInPhoto, index: number) => {
    if (!photo.url) return;
    setSharingPhoto(photo.url);
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const extension = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `check-in-step-${index + 1}.${extension}`, { type: blob.type || 'image/jpeg' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Check-in step ${index + 1}`, text: photo.caption });
      } else if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopiedKey(`photo:${index}`);
        window.setTimeout(() => setCopiedKey(''), 1800);
      } else {
        const link = document.createElement('a');
        link.href = photo.url;
        link.download = file.name;
        link.click();
      }
    } finally {
      setSharingPhoto('');
    }
  };

  if (!activeRecord) return null;

  const fullStepText = displayedSteps
    .map((step, index) => `STEP ${index + 1}\n${stripMarkdown(step)}`)
    .join('\n\n');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Guest access</p>
                <h2 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">Check-in guides</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{records.length}</span>
            </div>

            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Find an apartment…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950 md:text-xs"
              />
            </label>
          </div>

          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto p-2 lg:max-h-[calc(100vh-210px)]">
            {filteredRecords.map(record => (
              <button
                key={record.id}
                type="button"
                onClick={() => setActiveId(record.id)}
                className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition ${
                  activeRecord.id === record.id
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200'
                    : 'border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50 dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-950'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  activeRecord.id === record.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}>
                  <KeyRound className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[10px] font-extrabold leading-4">{record.apartment}</span>
                  {record.lockboxType && <span className="mt-0.5 block truncate text-[9px] opacity-60">{record.lockboxType}</span>}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            ))}
            {filteredRecords.length === 0 && (
              <p className="p-6 text-center text-[10px] text-slate-400">No matching apartment.</p>
            )}
          </div>
        </div>
      </aside>

      <main className="space-y-4 lg:col-span-8 xl:col-span-9">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Active guide</p>
                <h3 className="mt-1 text-base font-extrabold leading-6 text-slate-900 dark:text-white sm:text-lg">{activeRecord.apartment}</h3>
                {activeRecord.notes && <p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500 dark:text-slate-400">{activeRecord.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => void copyText('guide', fullStepText || activeRecord.instructions)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-extrabold transition ${
                  copiedKey === 'guide'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copiedKey === 'guide' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === 'guide' ? 'Guide copied' : 'Copy guest guide'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {activeRecord.lockboxCode && activeRecord.lockboxCode !== '—' && (
              <QuickDetail
                label={`Lockbox code${activeRecord.lockboxType ? ` · ${activeRecord.lockboxType}` : ''}`}
                value={activeRecord.lockboxCode}
                copied={copiedKey === 'code'}
                onCopy={() => void copyText('code', activeRecord.lockboxCode || '')}
              />
            )}
            {activeRecord.keyAddress && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Key collection</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-800 dark:text-slate-200">{activeRecord.keyAddress}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void copyText('address', activeRecord.keyAddress || '')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {copiedKey === 'address' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    Copy address
                  </button>
                  {activeRecord.keyMapUrl && (
                    <a href={activeRecord.keyMapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      <MapPin className="h-3 w-3" /> Open map <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {activeRecord.photos.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><ImageIcon className="h-4 w-4 text-indigo-500" /> Visual walkthrough</h3>
                <p className="mt-1 text-[9px] text-slate-400">Tap an image to enlarge. Use Share on mobile to send it directly.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {activeRecord.photos.map((photo, index) => (
                <article key={`${activeRecord.id}:${index}`} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <button type="button" onClick={() => setSelectedPhoto(photo)} className="relative block aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {photo.url ? (
                      <img src={photo.url} alt={photo.caption} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-slate-400">Image unavailable</span>
                    )}
                    <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-extrabold text-white shadow">{index + 1}</span>
                  </button>
                  <div className="space-y-2 p-2.5">
                    <p className="line-clamp-2 min-h-8 text-[9px] leading-4 text-slate-600 dark:text-slate-400">{photo.caption}</p>
                    <button type="button" onClick={() => void sharePhoto(photo, index)} disabled={sharingPhoto === photo.url} className="flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[9px] font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {copiedKey === `photo:${index}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Share2 className="h-3 w-3" />}
                      {sharingPhoto === photo.url ? 'Preparing…' : copiedKey === `photo:${index}` ? 'Copied' : 'Share image'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><Sparkles className="h-4 w-4 text-amber-500" /> Step-by-step guest message</h3>
              <p className="mt-1 text-[9px] text-slate-400">Choose one language before copying the guide.</p>
            </div>
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              {([['vi', '🇻🇳 VI'], ['en', '🇬🇧 EN'], ['bilingual', '↔ Both']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setLanguage(value)} className={`rounded-lg px-3 py-2 text-[9px] font-extrabold transition ${language === value ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {displayedSteps.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {displayedSteps.map((step, index) => (
                <li key={`${language}:${index}`} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[9px] font-extrabold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1 whitespace-pre-line text-[11px] leading-5 text-slate-650 dark:text-slate-300"><RichText text={step} /></div>
                  <button type="button" onClick={() => void copyText(`step:${index}`, stripMarkdown(step))} className="h-fit shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900">
                    {copiedKey === `step:${index}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-[11px] leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300" open>
              <summary className="cursor-pointer font-extrabold">Original check-in details</summary>
              <p className="mt-3 whitespace-pre-wrap">{activeRecord.instructions}</p>
            </details>
          )}
        </section>
      </main>

      {selectedPhoto && (
        <div role="dialog" aria-modal="true" aria-label="Check-in photo" onClick={() => setSelectedPhoto(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-8">
          <div onClick={event => event.stopPropagation()} className="relative max-h-full max-w-5xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl">
            <img src={selectedPhoto.url} alt={selectedPhoto.caption} className="max-h-[78vh] w-auto max-w-full object-contain" />
            <div className="flex items-start justify-between gap-4 border-t border-white/10 p-3 text-[11px] leading-5 text-slate-200 sm:p-4">
              <p>{selectedPhoto.caption}</p>
              <a href={selectedPhoto.url} download="check-in-photo.jpg" className="shrink-0 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Save photo"><Download className="h-4 w-4" /></a>
            </div>
            <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80" aria-label="Close image"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickDetail({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">{label}</p>
        <p className="mt-1 font-mono text-base font-extrabold tracking-wider text-amber-900 dark:text-amber-200">{value}</p>
      </div>
      <button type="button" onClick={onCopy} className="rounded-lg border border-amber-200 bg-white p-2 text-amber-700 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-400">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function buildSteps(language: Language, viSteps: string[], enSteps: string[]): string[] {
  if (language === 'vi') return viSteps;
  if (language === 'en') return enSteps;
  const length = Math.max(viSteps.length, enSteps.length);
  return Array.from({ length }, (_, index) => {
    const parts = [];
    if (viSteps[index]) parts.push(`🇻🇳 ${viSteps[index]}`);
    if (enSteps[index]) parts.push(`🇬🇧 ${enSteps[index]}`);
    return parts.join('\n\n');
  });
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '');
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">{part.slice(1, -1)}</code>;
    return part;
  });
}
