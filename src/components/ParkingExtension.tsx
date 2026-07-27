import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronRight, Copy, ExternalLink, Image as ImageIcon, KeyRound, MapPin, Search, Sparkles, X } from 'lucide-react';
import { useUiLanguage } from '../i18n';
import { BLISS_GARAGE_77_IMAGE } from '../assets/parkingImages';

type Lang = 'vi' | 'en';
type Photo = { url: string; vi: string; en: string };
type Guide = {
  id: string; apartment: string; status: [string, string]; location: [string, string]; access: [string, string];
  spot?: string; map?: string; note: [string, string]; steps: [string[], string[]]; message: [string, string]; photos: Photo[];
};

const GUIDES: Guide[] = [
  {
    id: 'enclave', apartment: '3BR Enclave | Fish Market & Casino',
    status: ['Bãi xe trả phí · chủ nhà hoàn lại', 'Paid parking · reimbursed by host'],
    location: ['Bãi xe an toàn gần căn hộ, đi bộ khoảng 3–4 phút', 'Secure paid car park nearby, about a 3–4 minute walk'],
    access: ['Tap & pay hoặc đặt chỗ trước', 'Tap & pay or pre-book'],
    note: ['Không có thẻ đậu xe cần nhận. Hãy giữ hóa đơn hoặc xác nhận đặt chỗ để được hoàn lại chi phí.', 'There is no parking card to collect. Keep the receipt or booking confirmation for reimbursement.'],
    steps: [[
      'Bãi đậu xe nằm ngoài tòa nhà, cách căn hộ khoảng **3–4 phút đi bộ**.',
      'Khách có thể dùng **tap & pay** hoặc **đặt chỗ trước**.',
      'Giữ lại **hóa đơn hoặc xác nhận đặt chỗ** sau khi thanh toán.',
      'Gửi hóa đơn cho chủ nhà để được **hoàn lại chi phí đậu xe trong thời gian lưu trú**.',
    ], [
      'Parking is off-site, approximately a **3–4 minute walk** from the apartment.',
      'Use **tap & pay** at the car park or **pre-book** a space.',
      'Keep the **receipt or booking confirmation** after payment.',
      'Send the receipt to the host so the **parking cost for your stay can be reimbursed**.',
    ]],
    message: [`Xin chào,\n\nChỗ đậu xe cho căn 3BR Enclave | Fish Market & Casino nằm tại một bãi xe an toàn cách căn hộ khoảng 3–4 phút đi bộ.\n\nBạn có thể sử dụng tap & pay hoặc đặt chỗ trước. Bên mình sẽ chi trả chi phí đậu xe trong thời gian lưu trú. Vui lòng giữ lại hóa đơn hoặc xác nhận đặt chỗ và gửi cho bên mình sau khi thanh toán để được hoàn lại chi phí.\n\nLưu ý: bãi xe nằm ngoài tòa nhà và không có thẻ đậu xe cần nhận.\n\nCảm ơn bạn.`, `Hi,\n\nParking for 3BR Enclave | Fish Market & Casino is available at a secure paid car park approximately a 3–4 minute walk from the apartment.\n\nYou may use tap & pay or pre-book a space. We will cover the parking cost for your stay. Please keep the receipt or booking confirmation and send it to us after payment so we can arrange reimbursement.\n\nPlease note that parking is off-site and there is no parking card to collect.\n\nThank you.`],
    photos: [],
  },
  {
    id: 'bliss', apartment: 'Bliss Terrace City Pad | 2 Balcony',
    status: ['Đậu xe miễn phí', 'Free parking included'],
    location: ['1–19 Allen Street, Pyrmont', '1–19 Allen Street, Pyrmont'],
    access: ['Nhận remote fob trong hộp thư trước', 'Collect the remote fob from the mailbox first'],
    spot: 'Garage #77', map: 'https://www.google.com/maps/search/?api=1&query=1-19+Allen+Street+Pyrmont+NSW',
    note: ['Đây là khu dân cư. Không nhắc đến Airbnb. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.', 'This is a residential building. Do not mention Airbnb. If asked, say you are a friend of the parking owner.'],
    steps: [[
      'Nhận **bộ chìa khóa và remote fob** từ hộp thư trước.',
      'Đi đến **1–19 Allen Street, Pyrmont** và dùng remote fob để vào bãi xe.',
      'Tìm đúng vị trí **Garage #77** như trong ảnh.',
      'Không nhắc đến **Airbnb**. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
      'Khi trả phòng, trả lại **remote fob cùng bộ chìa khóa** vào lockbox.',
    ], [
      'Collect the **keyset and remote fob** from the mailbox first.',
      'Drive to **1–19 Allen Street, Pyrmont** and use the fob to enter the parking building.',
      'Locate and park in **Garage #77**, as shown in the photo.',
      'Do not mention **Airbnb**. If asked, say you are a friend of the parking owner.',
      'At checkout, return the **remote fob together with the keyset** to the lockbox.',
    ]],
    message: [`Xin chào,\n\nHy vọng bạn đang háo hức cho kỳ nghỉ sắp tới. Nếu bạn cần chỗ đậu xe, bên mình đã bổ sung tiện ích đậu xe miễn phí.\n\nBãi xe nằm tại 1–19 Allen Street, Pyrmont. Vui lòng nhận bộ chìa khóa và remote fob từ hộp thư trước, sau đó dùng remote để vào tòa nhà và tìm Garage #77.\n\nĐây là khu dân cư, vì vậy vui lòng không nhắc đến Airbnb. Nếu được hỏi, bạn có thể nói mình là bạn của chủ chỗ đậu xe.\n\nKhi trả phòng, remote fob phải được trả lại cùng bộ chìa khóa vào lockbox theo hướng dẫn checkout được gửi sau.\n\nCảm ơn bạn.`, `Hi,\n\nWe hope you're excited for your upcoming stay. If you require parking, we recently upgraded our stay amenities to include it for free.\n\nParking is located at 1–19 Allen Street, Pyrmont. Please collect the keyset and remote fob from our mailbox first, then use the fob to enter the residential parking building and locate Garage #77.\n\nThis is a residential building, so please do not mention Airbnb. If asked, you may say you are a friend of the parking owner.\n\nThe remote fob must be returned together with the keyset to the lockbox at checkout. The lockbox instructions will be sent separately.\n\nThanks.`],
    photos: [{ url: BLISS_GARAGE_77_IMAGE, vi: 'Vị trí đậu xe Garage #77 tại 1–19 Allen Street, Pyrmont.', en: 'Garage #77 parking bay at 1–19 Allen Street, Pyrmont.' }],
  },
];

const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold transition';
const pick = (lang: Lang, pair: [string, string]) => pair[lang === 'vi' ? 0 : 1];

export default function ParkingExtension() {
  const { language, text } = useUiLanguage();
  const [active, setActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'parking');
  const [hosts, setHosts] = useState<{ tabs: HTMLElement; content: HTMLElement } | null>(null);

  useEffect(() => {
    const locate = () => {
      const tab = document.getElementById('tab-checkin');
      const tabs = tab?.parentElement;
      const content = tabs?.parentElement?.nextElementSibling as HTMLElement | null;
      if (tabs && content) { content.dataset.appTabContent = 'true'; setHosts({ tabs, content }); }
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const tab = event.target instanceof Element ? event.target.closest('[id^="tab-"]') : null;
      if (tab && tab.id !== 'tab-parking') setActive(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (active) {
      document.documentElement.dataset.parkingActive = 'true';
      const url = new URL(location.href); url.searchParams.set('tab', 'parking'); history.replaceState({}, '', url);
    } else delete document.documentElement.dataset.parkingActive;
    return () => delete document.documentElement.dataset.parkingActive;
  }, [active]);

  if (!hosts) return null;
  return <>
    {createPortal(<button id="tab-parking" type="button" onClick={() => setActive(true)} className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5 text-xs font-extrabold shadow-xs transition-all sm:text-sm ${active ? 'scale-[1.03] border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}><Building2 className={`h-4 w-4 ${active ? '' : 'text-orange-500'}`} /><span className="md:hidden">Parking</span><span className="hidden md:inline">{text('Hướng dẫn đậu xe', 'Parking Guide')}</span></button>, hosts.tabs)}
    {active && createPortal(<div data-parking-panel="true"><ParkingPanel lang={language} /></div>, hosts.content)}
    <style>{`html[data-parking-active='true'] [data-app-tab-content='true']>:not([data-parking-panel='true']){display:none!important}html[data-parking-active='true'] [id^='tab-']:not(#tab-parking){opacity:.62;transform:none!important;filter:saturate(.45)}`}</style>
  </>;
}

function ParkingPanel({ lang }: { lang: Lang }) {
  const [query, setQuery] = useState('');
  const [id, setId] = useState(GUIDES[0].id);
  const [copied, setCopied] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [copying, setCopying] = useState(false);
  const cache = useRef<Map<string, Blob>>(new Map());
  const t = (vi: string, en: string) => lang === 'vi' ? vi : en;
  const filtered = useMemo(() => GUIDES.filter(g => g.apartment.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const guide = GUIDES.find(g => g.id === id) || GUIDES[0];
  const steps = guide.steps[lang === 'vi' ? 0 : 1];
  const message = guide.message[lang === 'vi' ? 0 : 1];

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(v => v === key ? '' : v), 1800);
  };
  const copyPhoto = async (p: Photo) => {
    setCopying(true);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error();
      const blob = cache.current.get(p.url) || await asPng(p.url); cache.current.set(p.url, blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopied('photo'); setTimeout(() => setCopied(''), 1800);
    } catch { window.open(p.url, '_blank', 'noopener,noreferrer'); } finally { setCopying(false); }
  };

  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
    <aside className="lg:col-span-4 xl:col-span-3"><div className={`${card} overflow-hidden lg:sticky lg:top-24`}>
      <div className="border-b border-slate-100 p-4 dark:border-slate-800"><div className="flex items-center justify-between"><div><p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hỗ trợ khách', 'Guest support')}</p><h2 className="mt-1 text-sm font-extrabold">{t('Hướng dẫn đậu xe', 'Parking guides')}</h2></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-extrabold dark:bg-slate-800">{GUIDES.length}</span></div>
      <label className="relative mt-3 block"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder={t('Tìm căn hộ…', 'Find an apartment…')} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label></div>
      <div className="max-h-[55vh] space-y-1.5 overflow-y-auto p-2">{filtered.map(g => <button key={g.id} onClick={() => setId(g.id)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left ${guide.id === g.id ? 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950'}`}><Building2 className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1"><span className="line-clamp-2 text-[10px] font-extrabold leading-4">{g.apartment}</span><span className="block truncate text-[9px] opacity-60">{pick(lang, g.status)}</span></span><ChevronRight className="h-3.5 w-3.5" /></button>)}</div>
    </div></aside>

    <main className="space-y-4 lg:col-span-8 xl:col-span-9">
      <section className={`${card} overflow-hidden`}><div className="border-b border-slate-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-slate-800 dark:from-orange-950/20 dark:to-slate-900"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hướng dẫn đang chọn', 'Active parking guide')}</p><h3 className="mt-1 text-lg font-extrabold">{guide.apartment}</h3><p className="mt-2 text-[10px] font-bold text-emerald-600">{pick(lang, guide.status)}</p></div><button onClick={() => void copyText('guide', message)} className={`${btn} h-10 bg-orange-600 px-4 text-[10px] text-white`}>{copied === 'guide' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === 'guide' ? t('Đã sao chép', 'Guide copied') : t('Sao chép tin nhắn', 'Copy guest message')}</button></div></div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3"><Info icon={<MapPin className="h-4 w-4" />} label={t('Địa điểm', 'Location')} value={pick(lang, guide.location)}>{guide.map && <a href={guide.map} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-[9px] font-bold text-orange-800"><MapPin className="h-3 w-3" />{t('Mở bản đồ', 'Open map')}<ExternalLink className="h-2.5 w-2.5" /></a>}</Info><Info icon={<Check className="h-4 w-4" />} label={guide.spot ? t('Vị trí đậu', 'Parking spot') : t('Thanh toán', 'Payment')} value={guide.spot || pick(lang, guide.access)} /><Info icon={<KeyRound className="h-4 w-4" />} label={t('Cách vào bãi xe', 'Access')} value={pick(lang, guide.access)} /></div>
      <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><b>{t('Lưu ý:', 'Important:')}</b> {pick(lang, guide.note)}</div></section>

      {guide.photos.length > 0 && <section className={`${card} p-5`}><h3 className="flex items-center gap-2 text-xs font-extrabold"><ImageIcon className="h-4 w-4 text-orange-500" />{t('Hình nhận diện vị trí đậu xe', 'Parking photo')}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{guide.photos.map((p, i) => <article key={i} className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800"><button onClick={() => setPhoto(p)} className="relative block aspect-[4/3] w-full overflow-hidden"><img src={p.url} alt={lang === 'vi' ? p.vi : p.en} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 rounded-full bg-orange-600 px-2 py-1 text-[9px] font-extrabold text-white">#77</span></button><div className="p-3"><p className="text-[9px] leading-4 text-slate-500">{lang === 'vi' ? p.vi : p.en}</p><button onClick={() => void copyPhoto(p)} disabled={copying} className={`${btn} mt-2 h-8 w-full border border-slate-200 text-[9px] dark:border-slate-700`}>{copied === 'photo' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}{copying ? t('Đang sao chép…', 'Copying…') : copied === 'photo' ? t('Đã sao chép ảnh', 'Image copied') : t('Sao chép ảnh', 'Copy image')}</button></div></article>)}</div></section>}

      <section className={`${card} p-5`}><div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row"><div><h3 className="flex items-center gap-2 text-xs font-extrabold"><Sparkles className="h-4 w-4 text-orange-500" />{t('Tin nhắn hướng dẫn từng bước', 'Step-by-step guest message')}</h3></div><button onClick={() => void copyText('all', message)} className={`${btn} h-9 bg-orange-600 px-3 text-[10px] text-white`}><Copy className="h-3.5 w-3.5" />{copied === 'all' ? t('Đã sao chép tất cả', 'All copied') : t('Sao chép toàn bộ', 'Copy full message')}</button></div><ol className="mt-4 space-y-3">{steps.map((s, i) => <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-[9px] font-extrabold text-white">{i + 1}</span><div className="flex-1 text-[11px] leading-5"><Rich value={s} /></div><button onClick={() => void copyText(`s${i}`, strip(s))} className="h-fit rounded-lg border border-slate-200 p-1.5"><Copy className="h-3.5 w-3.5" /></button></li>)}</ol><details className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4 text-[11px] leading-5 dark:border-orange-900/50 dark:bg-orange-950/20"><summary className="cursor-pointer font-extrabold">{t('Xem tin nhắn hoàn chỉnh', 'Preview full message')}</summary><p className="mt-3 whitespace-pre-wrap">{message}</p></details></section>
    </main>

    {photo && <div onClick={() => setPhoto(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3"><div onClick={(e: ReactMouseEvent<HTMLDivElement>) => e.stopPropagation()} className="relative max-w-5xl overflow-hidden rounded-2xl bg-slate-900"><img src={photo.url} alt="Parking" className="max-h-[82vh] max-w-full object-contain" /><button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"><X className="h-4 w-4" /></button></div></div>}
  </div>;
}

function Info({ icon, label, value, children }: { icon: ReactNode; label: string; value: string; children?: ReactNode }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70"><div className="flex items-center gap-2 text-orange-600">{icon}<p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div><p className="mt-1.5 text-xs font-bold leading-5">{value}</p>{children}</div>; }
async function asPng(url: string) { const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b); try { const img = await new Promise<HTMLImageElement>((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = u; }); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d')!.drawImage(img, 0, 0); return await new Promise<Blob>((ok, no) => c.toBlob(v => v ? ok(v) : no(), 'image/png')); } finally { URL.revokeObjectURL(u); } }
const strip = (v: string) => v.replace(/\*\*/g, '').replace(/`/g, '');
function Rich({ value }: { value: string }) { return <>{value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p)}</>; }
