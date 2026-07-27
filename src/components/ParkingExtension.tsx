import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  CarFront,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useApartmentData } from '../data/ApartmentDataProvider';
import { useUiLanguage } from '../i18n';
import { BLISS_GARAGE_77_IMAGE } from '../assets/parkingImages';

type Lang = 'vi' | 'en';

type ParkingPhoto = {
  storagePath: string;
  captionVi: string;
  captionEn: string;
  url?: string;
};

type ParkingGuideData = {
  enabled: boolean;
  statusVi: string;
  statusEn: string;
  locationVi: string;
  locationEn: string;
  accessVi: string;
  accessEn: string;
  spot: string;
  mapUrl: string;
  noteVi: string;
  noteEn: string;
  instructionsVi: string[];
  instructionsEn: string[];
  messageVi: string;
  messageEn: string;
  photos: ParkingPhoto[];
};

type ParkingRecord = {
  id: string;
  apartment: string;
  parking: ParkingGuideData;
};

type PendingPhoto = {
  file: File;
  captionVi: string;
  captionEn: string;
  previewUrl: string;
};

const BUILTIN_BLISS_PHOTO = 'builtin:bliss-garage-77';
const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold transition';
const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const pick = (lang: Lang, vi: string, en: string) => lang === 'vi' ? vi : en;

function emptyParking(): ParkingGuideData {
  return {
    enabled: false,
    statusVi: '',
    statusEn: '',
    locationVi: '',
    locationEn: '',
    accessVi: '',
    accessEn: '',
    spot: '',
    mapUrl: '',
    noteVi: '',
    noteEn: '',
    instructionsVi: [],
    instructionsEn: [],
    messageVi: '',
    messageEn: '',
    photos: [],
  };
}

function defaultParkingFor(apartment: string): ParkingGuideData | null {
  const normalized = apartment.trim().toLocaleLowerCase();

  if (
    normalized === '55 little mount street - 3br enclave | fish market & casino'
    || normalized.endsWith('3br enclave | fish market & casino')
  ) {
    return {
      enabled: true,
      statusVi: 'Bãi xe trả phí · chủ nhà hoàn lại',
      statusEn: 'Paid parking · reimbursed by host',
      locationVi: 'Bãi xe an toàn gần căn hộ, đi bộ khoảng 3–4 phút',
      locationEn: 'Secure paid car park nearby, about a 3–4 minute walk',
      accessVi: 'Tap & pay hoặc đặt chỗ trước',
      accessEn: 'Tap & pay or pre-book',
      spot: '',
      mapUrl: '',
      noteVi: 'Không có thẻ đậu xe cần nhận. Hãy giữ hóa đơn hoặc xác nhận đặt chỗ để được hoàn lại chi phí.',
      noteEn: 'There is no parking card to collect. Keep the receipt or booking confirmation for reimbursement.',
      instructionsVi: [
        'Bãi đậu xe nằm ngoài tòa nhà, cách căn hộ khoảng **3–4 phút đi bộ**.',
        'Khách có thể dùng **tap & pay** hoặc **đặt chỗ trước**.',
        'Giữ lại **hóa đơn hoặc xác nhận đặt chỗ** sau khi thanh toán.',
        'Gửi hóa đơn cho chủ nhà để được **hoàn lại chi phí đậu xe trong thời gian lưu trú**.',
      ],
      instructionsEn: [
        'Parking is off-site, approximately a **3–4 minute walk** from the apartment.',
        'Use **tap & pay** at the car park or **pre-book** a space.',
        'Keep the **receipt or booking confirmation** after payment.',
        'Send the receipt to the host so the **parking cost for your stay can be reimbursed**.',
      ],
      messageVi: `Xin chào,\n\nChỗ đậu xe cho ${apartment} nằm tại một bãi xe an toàn cách căn hộ khoảng 3–4 phút đi bộ.\n\nBạn có thể sử dụng tap & pay hoặc đặt chỗ trước. Bên mình sẽ chi trả chi phí đậu xe trong thời gian lưu trú. Vui lòng giữ lại hóa đơn hoặc xác nhận đặt chỗ và gửi cho bên mình sau khi thanh toán để được hoàn lại chi phí.\n\nLưu ý: bãi xe nằm ngoài tòa nhà và không có thẻ đậu xe cần nhận.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nParking for ${apartment} is available at a secure paid car park approximately a 3–4 minute walk from the apartment.\n\nYou may use tap & pay or pre-book a space. We will cover the parking cost for your stay. Please keep the receipt or booking confirmation and send it to us after payment so we can arrange reimbursement.\n\nPlease note that parking is off-site and there is no parking card to collect.\n\nThank you.`,
      photos: [],
    };
  }

  if (normalized.endsWith('bliss terrace city pad | 2 balcony')) {
    return {
      enabled: true,
      statusVi: 'Đậu xe miễn phí',
      statusEn: 'Free parking included',
      locationVi: '1–19 Allen Street, Pyrmont',
      locationEn: '1–19 Allen Street, Pyrmont',
      accessVi: 'Nhận remote fob trong hộp thư trước',
      accessEn: 'Collect the remote fob from the mailbox first',
      spot: 'Garage #77',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=1-19+Allen+Street+Pyrmont+NSW',
      noteVi: 'Đây là khu dân cư. Không nhắc đến Airbnb. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
      noteEn: 'This is a residential building. Do not mention Airbnb. If asked, say you are a friend of the parking owner.',
      instructionsVi: [
        'Nhận **bộ chìa khóa và remote fob** từ hộp thư trước.',
        'Đi đến **1–19 Allen Street, Pyrmont** và dùng remote fob để vào bãi xe.',
        'Tìm đúng vị trí **Garage #77** như trong ảnh.',
        'Không nhắc đến **Airbnb**. Nếu được hỏi, hãy nói bạn là bạn của chủ chỗ đậu xe.',
        'Khi trả phòng, trả lại **remote fob cùng bộ chìa khóa** vào lockbox.',
      ],
      instructionsEn: [
        'Collect the **keyset and remote fob** from the mailbox first.',
        'Drive to **1–19 Allen Street, Pyrmont** and use the fob to enter the parking building.',
        'Locate and park in **Garage #77**, as shown in the photo.',
        'Do not mention **Airbnb**. If asked, say you are a friend of the parking owner.',
        'At checkout, return the **remote fob together with the keyset** to the lockbox.',
      ],
      messageVi: `Xin chào,\n\nHy vọng bạn đang háo hức cho kỳ nghỉ sắp tới. Nếu bạn cần chỗ đậu xe, bên mình đã bổ sung tiện ích đậu xe miễn phí.\n\nBãi xe nằm tại 1–19 Allen Street, Pyrmont. Vui lòng nhận bộ chìa khóa và remote fob từ hộp thư trước, sau đó dùng remote để vào tòa nhà và tìm Garage #77.\n\nĐây là khu dân cư, vì vậy vui lòng không nhắc đến Airbnb. Nếu được hỏi, bạn có thể nói mình là bạn của chủ chỗ đậu xe.\n\nKhi trả phòng, remote fob phải được trả lại cùng bộ chìa khóa vào lockbox theo hướng dẫn checkout được gửi sau.\n\nCảm ơn bạn.`,
      messageEn: `Hi,\n\nWe hope you're excited for your upcoming stay. If you require parking, we recently upgraded our stay amenities to include it for free.\n\nParking is located at 1–19 Allen Street, Pyrmont. Please collect the keyset and remote fob from our mailbox first, then use the fob to enter the residential parking building and locate Garage #77.\n\nThis is a residential building, so please do not mention Airbnb. If asked, you may say you are a friend of the parking owner.\n\nThe remote fob must be returned together with the keyset to the lockbox at checkout. The lockbox instructions will be sent separately.\n\nThanks.`,
      photos: [{
        storagePath: BUILTIN_BLISS_PHOTO,
        captionVi: 'Vị trí đậu xe Garage #77 tại 1–19 Allen Street, Pyrmont.',
        captionEn: 'Garage #77 parking bay at 1–19 Allen Street, Pyrmont.',
        url: BLISS_GARAGE_77_IMAGE,
      }],
    };
  }

  return null;
}

function parseParking(apartment: string, rawValue: unknown): ParkingGuideData {
  const fallback = defaultParkingFor(apartment) || emptyParking();
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {};
  const stringValue = (key: keyof ParkingGuideData, defaultValue: string) => hasOwn(raw, key)
    ? String(raw[key] ?? '')
    : defaultValue;
  const stepsValue = (key: 'instructionsVi' | 'instructionsEn', defaultValue: string[]) => hasOwn(raw, key)
    ? (Array.isArray(raw[key]) ? raw[key].map(value => String(value).trim()).filter(Boolean) : [])
    : defaultValue;
  const rawPhotos = hasOwn(raw, 'photos') && Array.isArray(raw.photos) ? raw.photos : fallback.photos;

  return {
    enabled: hasOwn(raw, 'enabled') ? raw.enabled === true : fallback.enabled,
    statusVi: stringValue('statusVi', fallback.statusVi),
    statusEn: stringValue('statusEn', fallback.statusEn),
    locationVi: stringValue('locationVi', fallback.locationVi),
    locationEn: stringValue('locationEn', fallback.locationEn),
    accessVi: stringValue('accessVi', fallback.accessVi),
    accessEn: stringValue('accessEn', fallback.accessEn),
    spot: stringValue('spot', fallback.spot),
    mapUrl: stringValue('mapUrl', fallback.mapUrl),
    noteVi: stringValue('noteVi', fallback.noteVi),
    noteEn: stringValue('noteEn', fallback.noteEn),
    instructionsVi: stepsValue('instructionsVi', fallback.instructionsVi),
    instructionsEn: stepsValue('instructionsEn', fallback.instructionsEn),
    messageVi: stringValue('messageVi', fallback.messageVi),
    messageEn: stringValue('messageEn', fallback.messageEn),
    photos: rawPhotos
      .filter(value => value && typeof value === 'object')
      .map(value => {
        const photo = value as Record<string, unknown>;
        const storagePath = String(photo.storagePath || '');
        return {
          storagePath,
          captionVi: String(photo.captionVi || photo.caption || ''),
          captionEn: String(photo.captionEn || photo.caption || ''),
          url: storagePath === BUILTIN_BLISS_PHOTO ? BLISS_GARAGE_77_IMAGE : '',
        };
      })
      .filter(photo => Boolean(photo.storagePath)),
  };
}

function useParkingRecords(active: boolean) {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setRecords([]);
      setLoading(true);
      setError('');
      return;
    }

    let hydrationVersion = 0;
    setLoading(true);
    return onSnapshot(
      collection(db, 'apartments'),
      snapshot => {
        const version = ++hydrationVersion;
        const parsed = snapshot.docs
          .map(snapshotDoc => {
            const value = snapshotDoc.data() as Record<string, unknown>;
            const apartment = String(value.apartment || snapshotDoc.id);
            return {
              id: snapshotDoc.id,
              apartment,
              parking: parseParking(apartment, value.parking),
            } satisfies ParkingRecord;
          })
          .sort((first, second) => first.apartment.localeCompare(second.apartment));

        setRecords(parsed);
        setLoading(false);
        setError('');

        void Promise.all(parsed.map(async record => ({
          ...record,
          parking: {
            ...record.parking,
            photos: await Promise.all(record.parking.photos.map(async photo => {
              if (photo.storagePath === BUILTIN_BLISS_PHOTO) return { ...photo, url: BLISS_GARAGE_77_IMAGE };
              try {
                return { ...photo, url: await getDownloadURL(ref(storage, photo.storagePath)) };
              } catch {
                return { ...photo, url: '' };
              }
            })),
          },
        }))).then(hydrated => {
          if (version === hydrationVersion) setRecords(hydrated);
        });
      },
      snapshotError => {
        setLoading(false);
        setError(snapshotError.message || 'Unable to load parking guides.');
      },
    );
  }, [active]);

  return { records, loading, error };
}

export default function ParkingExtension() {
  const { canEdit, status } = useApartmentData();
  const { language, text } = useUiLanguage();
  const { records, loading, error } = useParkingRecords(status === 'ready');
  const [parkingActive, setParkingActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'parking');
  const [manageActive, setManageActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'manage');
  const [hosts, setHosts] = useState<{ tabs: HTMLElement; content: HTMLElement } | null>(null);

  useEffect(() => {
    const locate = () => {
      const tab = document.getElementById('tab-checkin');
      const tabs = tab?.parentElement;
      const content = tabs?.parentElement?.nextElementSibling as HTMLElement | null;
      if (tabs && content) {
        content.dataset.appTabContent = 'true';
        setHosts(current => current?.tabs === tabs && current.content === content ? current : { tabs, content });
      }
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const tab = event.target instanceof Element ? event.target.closest('[id^="tab-"]') : null;
      if (!tab) return;
      setParkingActive(tab.id === 'tab-parking');
      setManageActive(tab.id === 'tab-manage');
    };
    document.addEventListener('click', handleTabClick);
    return () => document.removeEventListener('click', handleTabClick);
  }, []);

  useEffect(() => {
    if (parkingActive) {
      document.documentElement.dataset.parkingActive = 'true';
      const url = new URL(location.href);
      url.searchParams.set('tab', 'parking');
      history.replaceState({}, '', url);
    } else {
      delete document.documentElement.dataset.parkingActive;
    }
    return () => delete document.documentElement.dataset.parkingActive;
  }, [parkingActive]);

  if (!hosts) return null;

  return <>
    {createPortal(
      <button
        id="tab-parking"
        type="button"
        onClick={() => { setParkingActive(true); setManageActive(false); }}
        className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5 text-xs font-extrabold shadow-xs transition-all sm:text-sm ${
          parkingActive
            ? 'scale-[1.03] border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <CarFront className={`h-4 w-4 ${parkingActive ? '' : 'text-orange-500'}`} />
        <span className="md:hidden">Parking</span>
        <span className="hidden md:inline">{text('Hướng dẫn đậu xe', 'Parking Guide')}</span>
      </button>,
      hosts.tabs,
    )}

    {parkingActive && createPortal(
      <div data-parking-panel="true">
        <ParkingPanel records={records} loading={loading} error={error} lang={language} />
      </div>,
      hosts.content,
    )}

    {canEdit && manageActive && createPortal(
      <div data-parking-manager="true" className="mt-5">
        <ParkingManager records={records} loading={loading} error={error} />
      </div>,
      hosts.content,
    )}

    <style>{`
      #tab-parking{order:98}
      #tab-manage{order:99}
      html[data-parking-active='true'] [data-app-tab-content='true']>:not([data-parking-panel='true']){display:none!important}
      html[data-parking-active='true'] [id^='tab-']:not(#tab-parking){opacity:.62;transform:none!important;filter:saturate(.45)}
    `}</style>
  </>;
}

function ParkingPanel({ records, loading, error, lang }: { records: ParkingRecord[]; loading: boolean; error: string; lang: Lang }) {
  const guides = useMemo(() => records.filter(record => record.parking.enabled), [records]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ParkingPhoto | null>(null);
  const [copyingPhoto, setCopyingPhoto] = useState('');
  const pngCache = useRef<Map<string, Blob>>(new Map());
  const t = (vi: string, en: string) => pick(lang, vi, en);

  useEffect(() => {
    if (!guides.length) {
      setActiveId('');
      return;
    }
    if (!guides.some(record => record.id === activeId)) setActiveId(guides[0].id);
  }, [activeId, guides]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return guides;
    return guides.filter(record => record.apartment.toLocaleLowerCase().includes(normalized));
  }, [guides, query]);

  const record = guides.find(item => item.id === activeId) || guides[0];
  if (loading) return <LoadingCard label={t('Đang tải hướng dẫn đậu xe…', 'Loading parking guides…')} />;
  if (error) return <ErrorCard message={error} />;
  if (!record) return <EmptyCard message={t('Chưa có căn hộ nào bật Parking Guide.', 'No apartment has Parking Guide enabled yet.')} />;

  const guide = record.parking;
  const steps = lang === 'vi' ? guide.instructionsVi : guide.instructionsEn;
  const message = lang === 'vi' ? guide.messageVi : guide.messageEn;

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(current => current === key ? '' : current), 1800);
  };

  const copyPhoto = async (photo: ParkingPhoto, index: number) => {
    if (!photo.url) return;
    setCopyingPhoto(photo.storagePath);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard is not supported.');
      let png = pngCache.current.get(photo.url);
      if (!png) {
        png = await fetchImageAsPng(photo.url);
        pngCache.current.set(photo.url, png);
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopied(`photo:${index}`);
      window.setTimeout(() => setCopied(current => current === `photo:${index}` ? '' : current), 1800);
    } finally {
      setCopyingPhoto('');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className={`${card} overflow-hidden lg:sticky lg:top-24`}>
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hỗ trợ khách', 'Guest support')}</p>
                <h2 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">{t('Hướng dẫn đậu xe', 'Parking guides')}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-extrabold dark:bg-slate-800">{guides.length}</span>
            </div>
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder={t('Tìm căn hộ…', 'Find an apartment…')} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" />
            </label>
          </div>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto p-2 lg:max-h-[calc(100vh-210px)]">
            {filtered.map(item => (
              <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition ${record.id === item.id ? 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950'}`}>
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[10px] font-extrabold leading-4">{item.apartment}</span>
                  <span className="block truncate text-[9px] opacity-60">{t(item.parking.statusVi, item.parking.statusEn)}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && <p className="p-6 text-center text-[10px] text-slate-400">{t('Không tìm thấy căn hộ.', 'No matching apartment.')}</p>}
          </div>
        </div>
      </aside>

      <main className="space-y-4 lg:col-span-8 xl:col-span-9">
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-slate-800 dark:from-orange-950/20 dark:to-slate-900">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-orange-600">{t('Hướng dẫn đang chọn', 'Active parking guide')}</p>
                <h3 className="mt-1 text-base font-extrabold leading-6 text-slate-900 dark:text-white sm:text-lg">{record.apartment}</h3>
                <p className="mt-2 text-[10px] font-bold text-emerald-600">{t(guide.statusVi, guide.statusEn)}</p>
              </div>
              <button type="button" onClick={() => void copyText('guide', message)} disabled={!message} className={`${btn} h-10 shrink-0 bg-orange-600 px-4 text-[10px] text-white disabled:opacity-40`}>
                {copied === 'guide' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'guide' ? t('Đã sao chép', 'Guide copied') : t('Sao chép tin nhắn', 'Copy guest message')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <Info icon={<MapPin className="h-4 w-4" />} label={t('Địa điểm', 'Location')} value={t(guide.locationVi, guide.locationEn)}>
              {guide.mapUrl && <a href={guide.mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1.5 text-[9px] font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300"><MapPin className="h-3 w-3" />{t('Mở bản đồ', 'Open map')}<ExternalLink className="h-2.5 w-2.5" /></a>}
            </Info>
            <Info icon={<CarFront className="h-4 w-4" />} label={guide.spot ? t('Vị trí đậu', 'Parking spot') : t('Hình thức', 'Parking type')} value={guide.spot || t(guide.statusVi, guide.statusEn)} />
            <Info icon={<KeyRound className="h-4 w-4" />} label={t('Cách vào bãi xe', 'Access')} value={t(guide.accessVi, guide.accessEn)} />
          </div>

          {(guide.noteVi || guide.noteEn) && <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><b>{t('Lưu ý:', 'Important:')}</b> {t(guide.noteVi, guide.noteEn)}</div>}
        </section>

        {guide.photos.length > 0 && (
          <section className={`${card} p-5`}>
            <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><ImageIcon className="h-4 w-4 text-orange-500" />{t('Hình nhận diện vị trí đậu xe', 'Parking photos')}</h3>
            <p className="mt-1 text-[9px] text-slate-400">{t('Chạm vào ảnh để phóng to hoặc sao chép ảnh vào tin nhắn.', 'Tap an image to enlarge or copy it into a message.')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {guide.photos.map((photo, index) => (
                <article key={`${photo.storagePath}:${index}`} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <button type="button" onClick={() => setSelectedPhoto(photo)} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {photo.url ? <img src={photo.url} alt={t(photo.captionVi, photo.captionEn)} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-slate-400">Image unavailable</span>}
                    <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[9px] font-extrabold text-white">{index + 1}</span>
                  </button>
                  <div className="p-3">
                    <p className="min-h-8 text-[9px] leading-4 text-slate-500 dark:text-slate-400">{t(photo.captionVi, photo.captionEn)}</p>
                    <button type="button" onClick={() => void copyPhoto(photo, index)} disabled={!photo.url || copyingPhoto === photo.storagePath} className={`${btn} mt-2 h-8 w-full border border-slate-200 bg-white text-[9px] text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}>
                      {copied === `photo:${index}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copyingPhoto === photo.storagePath ? t('Đang sao chép…', 'Copying…') : copied === `photo:${index}` ? t('Đã sao chép ảnh', 'Image copied') : t('Sao chép ảnh', 'Copy image')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={`${card} p-5`}>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white"><Sparkles className="h-4 w-4 text-orange-500" />{t('Tin nhắn hướng dẫn từng bước', 'Step-by-step guest message')}</h3>
              <p className="mt-1 text-[9px] text-slate-400">{t('Tên căn hộ được lấy trực tiếp từ cùng bản ghi Apartment Check-in.', 'The apartment name comes directly from the same Apartment Check-in record.')}</p>
            </div>
            <button type="button" onClick={() => void copyText('all', message)} disabled={!message} className={`${btn} h-9 bg-orange-600 px-3 text-[10px] text-white disabled:opacity-40`}>
              {copied === 'all' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'all' ? t('Đã sao chép tất cả', 'All copied') : t('Sao chép toàn bộ', 'Copy full message')}
            </button>
          </div>

          {steps.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={`${lang}:${index}`} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-[9px] font-extrabold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1 whitespace-pre-line text-[11px] leading-5 text-slate-700 dark:text-slate-300"><Rich value={step} /></div>
                  <button type="button" onClick={() => void copyText(`step:${index}`, stripMarkdown(step))} className="h-fit shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-orange-600 dark:border-slate-700 dark:bg-slate-900">
                    {copied === `step:${index}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950">{t('Chưa có các bước hướng dẫn.', 'No parking steps have been added.')}</p>}

          {message && <details className="mt-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4 text-[11px] leading-5 dark:border-orange-900/50 dark:bg-orange-950/20"><summary className="cursor-pointer font-extrabold">{t('Xem tin nhắn hoàn chỉnh', 'Preview full message')}</summary><p className="mt-3 whitespace-pre-wrap">{message}</p></details>}
        </section>
      </main>

      {selectedPhoto && (
        <div role="dialog" aria-modal="true" aria-label="Parking photo" onClick={() => setSelectedPhoto(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-8">
          <div onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()} className="relative max-h-full max-w-5xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl">
            <img src={selectedPhoto.url} alt={t(selectedPhoto.captionVi, selectedPhoto.captionEn)} className="max-h-[82vh] w-auto max-w-full object-contain" />
            <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80" aria-label="Close image"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParkingManager({ records, loading, error }: { records: ParkingRecord[]; loading: boolean; error: string }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editorVersion, setEditorVersion] = useState(0);

  useEffect(() => {
    if (!selectedId && records[0]) setSelectedId(records[0].id);
    if (selectedId && !records.some(record => record.id === selectedId)) setSelectedId(records[0]?.id || '');
  }, [records, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return records;
    return records.filter(record => record.apartment.toLocaleLowerCase().includes(normalized));
  }, [query, records]);
  const selected = records.find(record => record.id === selectedId) || records[0];

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-orange-200 bg-white shadow-lg shadow-orange-100/60 dark:border-orange-900 dark:bg-slate-900 dark:shadow-none">
      <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white p-4 dark:border-orange-900/50 dark:from-orange-950/30 dark:to-slate-900 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/20"><CarFront className="h-5 w-5" /></span>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">Parking Guide editor</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Chỉnh sửa hướng dẫn đậu xe</h2>
            <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">Parking Guide dùng trực tiếp cùng apartment ID và tên căn hộ của Apartment Check-in. Không tạo thêm tên căn hộ riêng hoặc bản ghi trùng.</p>
          </div>
        </div>
      </div>

      {loading ? <div className="p-5"><LoadingCard label="Loading apartment parking data…" /></div> : error ? <div className="p-5"><ErrorCard message={error} /></div> : records.length === 0 ? <div className="p-5"><EmptyCard message="No apartment data yet." /></div> : (
        <div className="grid gap-5 p-4 lg:grid-cols-[300px_1fr] sm:p-5">
          <aside className="space-y-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the same apartment list…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" />
            </label>
            <div className="max-h-[520px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 p-2 dark:border-slate-800">
              {filtered.map(record => (
                <button key={record.id} type="button" onClick={() => { setSelectedId(record.id); setEditorVersion(version => version + 1); }} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition ${selected?.id === record.id ? 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200' : 'border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950'}`}>
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 text-[10px] font-extrabold leading-4">{record.apartment}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-extrabold ${record.parking.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{record.parking.enabled ? 'Parking enabled' : 'Parking disabled'}</span>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && <p className="p-5 text-center text-[10px] text-slate-400">No matching apartment.</p>}
            </div>
          </aside>

          {selected && <ParkingEditor key={`${selected.id}:${editorVersion}`} record={selected} onSaved={() => setEditorVersion(version => version + 1)} />}
        </div>
      )}
    </section>
  );
}

function ParkingEditor({ record, onSaved }: { key?: string; record: ParkingRecord; onSaved: () => void }) {
  const [working, setWorking] = useState<ParkingGuideData>(() => cloneParking(record.parking));
  const [viSteps, setViSteps] = useState(() => stepsToText(record.parking.instructionsVi));
  const [enSteps, setEnSteps] = useState(() => stepsToText(record.parking.instructionsEn));
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pendingRef = useRef<PendingPhoto[]>([]);

  useEffect(() => { pendingRef.current = pendingPhotos; }, [pendingPhotos]);
  useEffect(() => () => pendingRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl)), []);

  const update = <K extends keyof ParkingGuideData>(field: K, value: ParkingGuideData[K]) => setWorking(current => ({ ...current, [field]: value }));

  const addPhotoFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files].filter(file => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024);
    setPendingPhotos(current => [...current, ...accepted.map(file => ({
      file,
      captionVi: file.name.replace(/\.[^.]+$/, ''),
      captionEn: file.name.replace(/\.[^.]+$/, ''),
      previewUrl: URL.createObjectURL(file),
    }))]);
    if (accepted.length !== files.length) setError('Only image files up to 10 MB were added.');
  };

  const removeExistingPhoto = (index: number) => {
    const photo = working.photos[index];
    if (photo && photo.storagePath !== BUILTIN_BLISS_PHOTO) setRemovedPaths(current => [...current, photo.storagePath]);
    update('photos', working.photos.filter((_, photoIndex) => photoIndex !== index));
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(current => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const uploaded: ParkingPhoto[] = [];
      for (const photo of pendingPhotos) {
        const storagePath = `apartment-media/${record.id}/${crypto.randomUUID()}-parking-${cleanFileName(photo.file.name)}`;
        await uploadBytes(ref(storage, storagePath), photo.file, {
          contentType: photo.file.type || 'image/jpeg',
          customMetadata: { apartmentId: record.id, mediaType: 'parking' },
        });
        uploaded.push({ storagePath, captionVi: photo.captionVi.trim(), captionEn: photo.captionEn.trim() });
      }

      const parking: ParkingGuideData = {
        ...working,
        statusVi: working.statusVi.trim(),
        statusEn: working.statusEn.trim(),
        locationVi: working.locationVi.trim(),
        locationEn: working.locationEn.trim(),
        accessVi: working.accessVi.trim(),
        accessEn: working.accessEn.trim(),
        spot: working.spot.trim(),
        mapUrl: working.mapUrl.trim(),
        noteVi: working.noteVi.trim(),
        noteEn: working.noteEn.trim(),
        instructionsVi: textToSteps(viSteps),
        instructionsEn: textToSteps(enSteps),
        messageVi: working.messageVi.trim(),
        messageEn: working.messageEn.trim(),
        photos: [...working.photos.map(({ storagePath, captionVi, captionEn }) => ({ storagePath, captionVi: captionVi.trim(), captionEn: captionEn.trim() })), ...uploaded],
      };

      await setDoc(doc(db, 'apartments', record.id), {
        parking,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email?.toLocaleLowerCase() || '',
      }, { merge: true });

      await Promise.allSettled(removedPaths.filter(path => path && path !== BUILTIN_BLISS_PHOTO).map(path => deleteObject(ref(storage, path))));
      pendingPhotos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
      setRemovedPaths([]);
      setWorking(parking);
      setViSteps(stepsToText(parking.instructionsVi));
      setEnSteps(stepsToText(parking.instructionsEn));
      setMessage('Parking Guide saved successfully. The Parking tab will update automatically.');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save Parking Guide.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-orange-600">Mapped Apartment Check-in record</p>
        <p className="mt-1 text-sm font-extrabold leading-6 text-slate-900 dark:text-white">{record.apartment}</p>
        <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">Apartment ID: <code className="rounded bg-white px-1 py-0.5 dark:bg-slate-900">{record.id}</code>. Renaming this apartment in the normal editor automatically changes its name in Parking Guide too.</p>
      </div>

      {(message || error) && <div className={`rounded-xl border p-3 text-[10px] font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{error || message}</div>}

      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
        <span><span className="block text-[10px] font-extrabold text-slate-800 dark:text-slate-200">Enable Parking Guide for this apartment</span><span className="mt-0.5 block text-[9px] text-slate-400">Only enabled apartments appear in the Parking tab.</span></span>
        <input type="checkbox" checked={working.enabled} onChange={event => update('enabled', event.target.checked)} className="h-5 w-5 accent-orange-600" />
      </label>

      <FormSection title="Parking summary">
        <Field label="🇻🇳 Trạng thái" value={working.statusVi} onChange={value => update('statusVi', value)} />
        <Field label="🇬🇧 Status" value={working.statusEn} onChange={value => update('statusEn', value)} />
        <Field label="🇻🇳 Địa điểm" value={working.locationVi} onChange={value => update('locationVi', value)} />
        <Field label="🇬🇧 Location" value={working.locationEn} onChange={value => update('locationEn', value)} />
        <Field label="🇻🇳 Cách vào bãi xe" value={working.accessVi} onChange={value => update('accessVi', value)} />
        <Field label="🇬🇧 Access" value={working.accessEn} onChange={value => update('accessEn', value)} />
        <Field label="Parking spot / Garage number" value={working.spot} onChange={value => update('spot', value)} />
        <Field label="Google Maps URL" value={working.mapUrl} onChange={value => update('mapUrl', value)} />
      </FormSection>

      <FormSection title="Important notes">
        <TextArea label="🇻🇳 Lưu ý quan trọng" value={working.noteVi} onChange={value => update('noteVi', value)} rows={5} />
        <TextArea label="🇬🇧 Important note" value={working.noteEn} onChange={value => update('noteEn', value)} rows={5} />
      </FormSection>

      <FormSection title="Step-by-step parking instructions">
        <div className="col-span-full rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-[10px] leading-5 text-orange-800 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300">Mỗi bước cách nhau bằng một dòng trống, giống Apartment Check-in. Nội dung VI và EN được Copy theo nút ngôn ngữ hiện tại.</div>
        <TextArea label="🇻🇳 HƯỚNG DẪN ĐẬU XE TIẾNG VIỆT" helper="Chừa một dòng trống giữa hai bước." value={viSteps} onChange={value => { setViSteps(value); update('instructionsVi', textToSteps(value)); }} rows={9} />
        <TextArea label="🇬🇧 ENGLISH PARKING INSTRUCTIONS" helper="Leave one blank line between steps." value={enSteps} onChange={value => { setEnSteps(value); update('instructionsEn', textToSteps(value)); }} rows={9} />
      </FormSection>

      <FormSection title="Full guest message">
        <TextArea label="🇻🇳 Tin nhắn hoàn chỉnh để Copy" value={working.messageVi} onChange={value => update('messageVi', value)} rows={11} />
        <TextArea label="🇬🇧 Full guest message to Copy" value={working.messageEn} onChange={value => update('messageEn', value)} rows={11} />
      </FormSection>

      <FormSection title="Parking photos">
        <div className="col-span-full grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {working.photos.map((photo, index) => (
            <ParkingPhotoEditor
              key={`${photo.storagePath}:${index}`}
              src={photo.url || (photo.storagePath === BUILTIN_BLISS_PHOTO ? BLISS_GARAGE_77_IMAGE : '')}
              captionVi={photo.captionVi}
              captionEn={photo.captionEn}
              onCaptionVi={value => update('photos', working.photos.map((item, photoIndex) => photoIndex === index ? { ...item, captionVi: value } : item))}
              onCaptionEn={value => update('photos', working.photos.map((item, photoIndex) => photoIndex === index ? { ...item, captionEn: value } : item))}
              onRemove={() => removeExistingPhoto(index)}
            />
          ))}
          {pendingPhotos.map((photo, index) => (
            <ParkingPhotoEditor
              key={photo.previewUrl}
              src={photo.previewUrl}
              captionVi={photo.captionVi}
              captionEn={photo.captionEn}
              onCaptionVi={value => setPendingPhotos(current => current.map((item, photoIndex) => photoIndex === index ? { ...item, captionVi: value } : item))}
              onCaptionEn={value => setPendingPhotos(current => current.map((item, photoIndex) => photoIndex === index ? { ...item, captionEn: value } : item))}
              onRemove={() => removePendingPhoto(index)}
              isNew
            />
          ))}
          <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-orange-600 transition hover:bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
            <ImagePlus className="h-6 w-6" />
            <span className="mt-2 text-[10px] font-extrabold">Add parking photos</span>
            <span className="mt-1 text-[8px] text-orange-400">JPG, PNG, WebP · max 10 MB</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={event => { addPhotoFiles(event.target.files); event.target.value = ''; }} />
          </label>
        </div>
      </FormSection>

      <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-[10px] font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving Parking Guide…' : 'Save Parking Guide'}
        </button>
      </div>
    </div>
  );
}

function cloneParking(parking: ParkingGuideData): ParkingGuideData {
  return {
    ...parking,
    instructionsVi: [...parking.instructionsVi],
    instructionsEn: [...parking.instructionsEn],
    photos: parking.photos.map(photo => ({ ...photo })),
  };
}

function stepsToText(steps: string[]) {
  return steps.join('\n\n');
}

function textToSteps(value: string) {
  return value.split(/\n\s*\n/g).map(step => step.trim()).filter(Boolean);
}

function cleanFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'parking-image.jpg';
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <div><h3 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500 dark:text-slate-400">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label>;
}

function TextArea({ label, helper, value, onChange, rows = 8 }: { label: string; helper?: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label><span className="mb-1 block text-[10px] font-extrabold text-slate-600 dark:text-slate-300">{label}</span>{helper && <span className="mb-2 block text-[9px] leading-4 text-slate-400">{helper}</span>}<textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-base leading-5 text-slate-800 outline-none transition focus:border-orange-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label>;
}

function ParkingPhotoEditor({ src, captionVi, captionEn, onCaptionVi, onCaptionEn, onRemove, isNew = false }: {
  key?: string;
  src: string;
  captionVi: string;
  captionEn: string;
  onCaptionVi: (value: string) => void;
  onCaptionEn: (value: string) => void;
  onRemove: () => void;
  isNew?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
        {src ? <img src={src} alt={captionEn || captionVi} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] text-slate-400">Loading image…</span>}
        <button type="button" onClick={onRemove} className="absolute right-2 top-2 rounded-full bg-rose-600 p-1.5 text-white shadow"><Trash2 className="h-3 w-3" /></button>
        {isNew && <span className="absolute left-2 top-2 rounded-full bg-orange-600 px-2 py-1 text-[8px] font-extrabold text-white">NEW</span>}
      </div>
      <div className="space-y-1.5 border-t border-slate-200 p-2 dark:border-slate-700">
        <input value={captionVi} onChange={event => onCaptionVi(event.target.value)} placeholder="🇻🇳 Chú thích ảnh" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900" />
        <input value={captionEn} onChange={event => onCaptionEn(event.target.value)} placeholder="🇬🇧 Photo caption" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-900" />
      </div>
    </article>
  );
}

function Info({ icon, label, value, children }: { icon: ReactNode; label: string; value: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70"><div className="flex items-center gap-2 text-orange-600">{icon}<p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div><p className="mt-1.5 text-xs font-bold leading-5 text-slate-800 dark:text-slate-200">{value || '—'}</p>{children}</div>;
}

function LoadingCard({ label }: { label: string }) {
  return <div className={`${card} p-10 text-center`}><Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" /><p className="mt-3 text-xs text-slate-500">{label}</p></div>;
}

function ErrorCard({ message }: { message: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{message}</div>;
}

function EmptyCard({ message }: { message: string }) {
  return <div className={`${card} p-10 text-center`}><CarFront className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-xs text-slate-400">{message}</p></div>;
}

async function fetchImageAsPng(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Image download failed.');
  const source = await response.blob();
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The browser could not decode this image.'));
      element.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion failed.');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG conversion failed.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, '').replace(/`/g, '');
}

function Rich({ value }: { value: string }) {
  return <>{value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">{part.slice(1, -1)}</code>;
    return part;
  })}</>;
}
