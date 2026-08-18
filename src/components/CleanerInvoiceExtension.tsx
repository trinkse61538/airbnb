import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Copy,
  DollarSign,
  FileText,
  ImageDown,
  Loader2,
  Plus,
  Receipt,
  Save,
  Search,
  Share2,
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
import { auth, db } from '../firebase';
import { useApartmentData } from '../data/ApartmentDataProvider';
import { useUiLanguage } from '../i18n';

type Lang = 'vi' | 'en';

type PricingRecord = {
  id: string;
  apartment: string;
  unitPrice: number;
  storedUnitPrice: number | null;
};

type InvoiceLine = {
  id: string;
  apartmentId: string;
  apartment: string;
  serviceDates: string[];
  shifts: number;
  unitPrice: number;
};

type InvoiceDraft = {
  invoiceNo: string;
  issueDate: string;
  invoiceMonth: string;
  cleanerName: string;
  clientName: string;
  lines: InvoiceLine[];
};

type ExportInvoice = InvoiceDraft & {
  servicePeriod: string;
  grandTotal: number;
};

const DRAFT_KEY = 'cleaner_invoice_draft_v1';
const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const button = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50';

const DEFAULT_PRICING: Array<{ match: string; price: number }> = [
  { match: '1/175 Harris St', price: 60 },
  { match: '1306/60 Bathurst St', price: 55 },
  { match: '17/30 Saunders Street', price: 100 },
  { match: '18/333 Bulwara', price: 60 },
  { match: '278 Harris St', price: 85 },
  { match: '3002/38 York St', price: 100 },
  { match: '32 Bland St', price: 90 },
  { match: '345/243 Pyrmont Street', price: 55 },
  { match: '35/48 Upper Pitt Street', price: 60 },
  { match: '48 High St', price: 85 },
  { match: '55 Little Mount Street', price: 105 },
  { match: '69 Harris St', price: 100 },
  { match: '7 Corfu St', price: 80 },
  { match: '7 Little Mount St', price: 100 },
  { match: '805/50 Murray St', price: 75 },
  { match: '1409/98 Gloucester St', price: 60 },
  { match: '2/122 Kirribilli Ave', price: 80 },
  { match: '28/2A Henry Lawson Ave', price: 50 },
];

function pick(lang: Lang, vi: string, en: string): string {
  return lang === 'vi' ? vi : en;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function defaultPriceFor(apartment: string): number {
  const normalized = normalize(apartment);
  const match = DEFAULT_PRICING.find(item => normalized.includes(normalize(item.match)));
  return match?.price ?? 0;
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function defaultInvoiceNo(month = currentMonth()): string {
  return `INV-${month.replace('-', '')}-001`;
}

function createInitialDraft(): InvoiceDraft {
  return {
    invoiceNo: defaultInvoiceNo(),
    issueDate: todayIso(),
    invoiceMonth: currentMonth(),
    cleanerName: '',
    clientName: 'Nathan',
    lines: [],
  };
}

function loadDraft(): InvoiceDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return createInitialDraft();
    const parsed = JSON.parse(raw) as Partial<InvoiceDraft>;
    return {
      invoiceNo: typeof parsed.invoiceNo === 'string' && parsed.invoiceNo ? parsed.invoiceNo : defaultInvoiceNo(),
      issueDate: typeof parsed.issueDate === 'string' && parsed.issueDate ? parsed.issueDate : todayIso(),
      invoiceMonth: typeof parsed.invoiceMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.invoiceMonth) ? parsed.invoiceMonth : currentMonth(),
      cleanerName: typeof parsed.cleanerName === 'string' ? parsed.cleanerName : '',
      clientName: typeof parsed.clientName === 'string' && parsed.clientName ? parsed.clientName : 'Nathan',
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.filter(line => line && typeof line === 'object').map(line => ({
            id: String(line.id || crypto.randomUUID()),
            apartmentId: String(line.apartmentId || ''),
            apartment: String(line.apartment || ''),
            serviceDates: Array.isArray(line.serviceDates) ? line.serviceDates.map(String).sort() : [],
            shifts: Number(line.shifts) || 0,
            unitPrice: Number(line.unitPrice) || 0,
          })).filter(line => line.apartment && line.shifts > 0 && line.unitPrice > 0)
        : [],
    };
  } catch {
    return createInitialDraft();
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatServiceDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function parseServiceDays(input: string, invoiceMonth: string): {
  dates: string[];
  tokenCount: number;
  invalid: string[];
} {
  const tokens = input
    .split(';')
    .map(token => token.trim())
    .filter(Boolean);
  const invalid: string[] = [];
  const dates: string[] = [];
  const [yearRaw, monthRaw] = invoiceMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  for (const token of tokens) {
    if (!/^\d{1,2}$/.test(token) || !year || !month) {
      invalid.push(token);
      continue;
    }
    const day = Number(token);
    const date = new Date(year, month - 1, day);
    if (
      day < 1
      || day > 31
      || date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) {
      invalid.push(token);
      continue;
    }
    dates.push(`${yearRaw}-${monthRaw}-${String(day).padStart(2, '0')}`);
  }

  return { dates: dates.sort(), tokenCount: tokens.length, invalid };
}

function computeServicePeriod(lines: InvoiceLine[]): string {
  const dates = lines.flatMap(line => line.serviceDates).filter(Boolean).sort();
  if (!dates.length) return '—';
  return dates[0] === dates[dates.length - 1]
    ? formatDate(dates[0])
    : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
}

function usePricingRecords(active: boolean) {
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setRecords([]);
      setLoading(true);
      setError('');
      return;
    }

    setLoading(true);
    return onSnapshot(
      collection(db, 'apartments'),
      snapshot => {
        const next = snapshot.docs
          .map(apartmentDoc => {
            const value = apartmentDoc.data() as Record<string, unknown>;
            const apartment = String(value.apartment || apartmentDoc.id);
            const storedUnitPrice = asPositiveNumber(value.cleanerUnitPrice);
            return {
              id: apartmentDoc.id,
              apartment,
              storedUnitPrice,
              unitPrice: storedUnitPrice ?? defaultPriceFor(apartment),
            } satisfies PricingRecord;
          })
          .sort((a, b) => a.apartment.localeCompare(b.apartment));
        setRecords(next);
        setLoading(false);
        setError('');
      },
      snapshotError => {
        setLoading(false);
        setError(snapshotError.message || 'Unable to load Cleaner Unit Price data.');
      },
    );
  }, [active]);

  return { records, loading, error };
}

export default function CleanerInvoiceExtension() {
  const { canEdit, status } = useApartmentData();
  const { language, text } = useUiLanguage();
  const { records, loading, error } = usePricingRecords(status === 'ready');
  const [invoiceActive, setInvoiceActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'cleaner-invoice');
  const [manageActive, setManageActive] = useState(() => new URLSearchParams(location.search).get('tab') === 'manage');
  const [hosts, setHosts] = useState<{ tabs: HTMLElement; content: HTMLElement } | null>(null);
  const [managerHost, setManagerHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const locate = () => {
      const anchorTab = document.getElementById('tab-checkin');
      const tabs = anchorTab?.parentElement;
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
      setInvoiceActive(tab.id === 'tab-cleaner-invoice');
      setManageActive(tab.id === 'tab-manage');
    };
    document.addEventListener('click', handleTabClick);
    return () => document.removeEventListener('click', handleTabClick);
  }, []);

  useEffect(() => {
    if (invoiceActive) {
      document.documentElement.dataset.cleanerInvoiceActive = 'true';
      const url = new URL(location.href);
      url.searchParams.set('tab', 'cleaner-invoice');
      history.replaceState({}, '', url);
    } else {
      delete document.documentElement.dataset.cleanerInvoiceActive;
    }
    return () => delete document.documentElement.dataset.cleanerInvoiceActive;
  }, [invoiceActive]);

  useEffect(() => {
    if (!hosts || !canEdit || !manageActive) {
      setManagerHost(null);
      document.getElementById('cleaner-unit-price-manager-host')?.remove();
      return;
    }

    const placeManagerHost = () => {
      const managementRoot = Array.from(hosts.content.children)
        .find(element => element instanceof HTMLElement && element.classList.contains('space-y-5')) as HTMLElement | undefined;
      if (!managementRoot) return;

      let mount = document.getElementById('cleaner-unit-price-manager-host') as HTMLElement | null;
      if (!mount) {
        mount = document.createElement('div');
        mount.id = 'cleaner-unit-price-manager-host';
        mount.dataset.cleanerUnitPriceManagerHost = 'true';
      }

      if (mount.parentElement !== managementRoot) {
        const parkingManager = document.getElementById('parking-manager-host');
        const accessSection = Array.from(managementRoot.querySelectorAll(':scope > section'))
          .find(section => section.textContent?.includes('Quyền truy cập')) as HTMLElement | undefined;
        if (parkingManager?.parentElement === managementRoot) {
          managementRoot.insertBefore(mount, parkingManager);
        } else if (accessSection) {
          managementRoot.insertBefore(mount, accessSection);
        } else {
          managementRoot.appendChild(mount);
        }
      }
      setManagerHost(current => current === mount ? current : mount);
    };

    placeManagerHost();
    const observer = new MutationObserver(placeManagerHost);
    observer.observe(hosts.content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [canEdit, hosts, manageActive]);

  if (!hosts) return null;

  return <>
    {createPortal(
      <button
        id="tab-cleaner-invoice"
        type="button"
        onClick={() => { setInvoiceActive(true); setManageActive(false); }}
        className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5 text-xs font-extrabold shadow-xs transition-all sm:text-sm ${
          invoiceActive
            ? 'scale-[1.03] border-cyan-500 bg-gradient-to-r from-cyan-600 to-sky-700 text-white shadow-md shadow-cyan-500/20'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <Receipt className={`h-4 w-4 ${invoiceActive ? '' : 'text-cyan-600'}`} />
        <span className="md:hidden">Invoice</span>
        <span className="hidden md:inline">{text('Hóa đơn Cleaner', 'Cleaner Invoice')}</span>
      </button>,
      hosts.tabs,
    )}

    {invoiceActive && createPortal(
      <div data-cleaner-invoice-panel="true">
        <CleanerInvoicePanel records={records} loading={loading} error={error} lang={language} />
      </div>,
      hosts.content,
    )}

    {canEdit && manageActive && managerHost && createPortal(
      <div data-cleaner-unit-price-manager="true">
        <CleanerUnitPriceManager records={records} loading={loading} error={error} lang={language} />
      </div>,
      managerHost,
    )}

    <style>{`
      #tab-parking{order:97}
      #tab-cleaner-invoice{order:98}
      #tab-manage{order:99}
      @media(min-width:1280px){
        .management-tab-grid{grid-template-columns:repeat(8,minmax(0,1fr))!important}
      }
      html[data-cleaner-invoice-active='true'] [data-app-tab-content='true']>:not([data-cleaner-invoice-panel='true']){display:none!important}
      html[data-cleaner-invoice-active='true'] [id^='tab-']:not(#tab-cleaner-invoice){opacity:.62;transform:none!important;filter:saturate(.45)}
    `}</style>
  </>;
}

function CleanerInvoicePanel({ records, loading, error, lang }: {
  records: PricingRecord[];
  loading: boolean;
  error: string;
  lang: Lang;
}) {
  const [draft, setDraft] = useState<InvoiceDraft>(() => loadDraft());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [shifts, setShifts] = useState<number | ''>(1);
  const [serviceDays, setServiceDays] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState('');
  const t = (vi: string, en: string) => pick(lang, vi, en);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Draft persistence is optional; the invoice still works without it.
    }
  }, [draft]);

  const selected = records.find(record => record.id === selectedId) || null;
  const filteredRecords = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return records;
    return records.filter(record => normalize(record.apartment).includes(normalizedQuery));
  }, [query, records]);

  const parsedDays = useMemo(
    () => parseServiceDays(serviceDays, draft.invoiceMonth),
    [draft.invoiceMonth, serviceDays],
  );
  const serviceCountMatches = typeof shifts === 'number' && shifts > 0 && parsedDays.tokenCount === shifts && parsedDays.invalid.length === 0;
  const servicePeriod = useMemo(() => computeServicePeriod(draft.lines), [draft.lines]);
  const grandTotal = useMemo(
    () => draft.lines.reduce((sum, line) => sum + line.shifts * line.unitPrice, 0),
    [draft.lines],
  );
  const totalShifts = useMemo(() => draft.lines.reduce((sum, line) => sum + line.shifts, 0), [draft.lines]);

  const selectApartment = (record: PricingRecord) => {
    setSelectedId(record.id);
    setQuery(record.apartment);
    setUnitPrice(record.unitPrice ? String(record.unitPrice) : '');
    setNotice('');
  };

  const addToInvoice = () => {
    if (!selected) {
      setNotice(t('Hãy chọn một căn hộ trước.', 'Select an apartment first.'));
      return;
    }
    if (!serviceCountMatches) {
      setNotice(t(
        `Bạn đã nhập ${shifts || 0} shift nhưng có ${parsedDays.tokenCount} service date. Hãy kiểm tra lại trước khi thêm vào invoice.`,
        `You entered ${shifts || 0} shift(s) but ${parsedDays.tokenCount} service date(s). Please check before adding to the invoice.`,
      ));
      return;
    }
    const parsedPrice = Number(unitPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setNotice(t('Unit price phải lớn hơn 0.', 'Unit price must be greater than 0.'));
      return;
    }
    setDraft(current => ({
      ...current,
      lines: [
        ...current.lines,
        {
          id: crypto.randomUUID(),
          apartmentId: selected.id,
          apartment: selected.apartment,
          serviceDates: parsedDays.dates,
          shifts: Number(shifts),
          unitPrice: Math.round(parsedPrice * 100) / 100,
        },
      ],
    }));
    setSelectedId('');
    setQuery('');
    setShifts(1);
    setServiceDays('');
    setUnitPrice('');
    setNotice(t('Đã thêm vào invoice và cập nhật Grand Total.', 'Added to invoice and Grand Total updated.'));
    window.setTimeout(() => setNotice(''), 2200);
  };

  const removeLine = (id: string) => {
    setDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== id) }));
  };

  const clearInvoice = () => {
    if (draft.lines.length && !window.confirm(t('Xóa toàn bộ invoice hiện tại?', 'Clear the current invoice?'))) return;
    const next = createInitialDraft();
    setDraft(next);
    setQuery('');
    setSelectedId('');
    setServiceDays('');
    setShifts(1);
    setUnitPrice('');
    setNotice('');
  };

  const exportData: ExportInvoice = {
    ...draft,
    servicePeriod,
    grandTotal,
  };

  const runExport = async (kind: 'copy' | 'share' | 'png' | 'pdf') => {
    if (!draft.lines.length) {
      setNotice(t('Invoice đang trống. Hãy Add to Invoice trước.', 'The invoice is empty. Add at least one item first.'));
      return;
    }
    setExporting(kind);
    setNotice('');
    try {
      const canvas = renderInvoiceCanvas(exportData);
      if (kind === 'copy') {
        await copyCanvas(canvas, exportData);
        setNotice(t('Đã copy invoice.', 'Invoice copied.'));
      } else if (kind === 'share') {
        const png = await canvasToBlob(canvas, 'image/png');
        const file = new File([png], `${safeFileName(draft.invoiceNo)}.png`, { type: 'image/png' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: draft.invoiceNo, text: `Cleaner invoice ${draft.invoiceNo}`, files: [file] });
          setNotice(t('Đã mở bảng Share invoice.', 'Share sheet opened.'));
        } else {
          downloadBlob(png, file.name);
          setNotice(t('Thiết bị không hỗ trợ Share file; invoice đã được tải xuống dạng PNG.', 'File sharing is unavailable; the invoice was downloaded as PNG instead.'));
        }
      } else if (kind === 'png') {
        const png = await canvasToBlob(canvas, 'image/png');
        downloadBlob(png, `${safeFileName(draft.invoiceNo)}.png`);
        setNotice(t('Đã tải invoice dạng PNG.', 'PNG invoice downloaded.'));
      } else {
        const pdf = await canvasToPdfBlob(canvas);
        downloadBlob(pdf, `${safeFileName(draft.invoiceNo)}.pdf`);
        setNotice(t('Đã tải invoice dạng PDF.', 'PDF invoice downloaded.'));
      }
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Unable to export invoice.';
      setNotice(message);
    } finally {
      setExporting('');
    }
  };

  if (loading) return <InfoCard icon={<Loader2 className="h-5 w-5 animate-spin" />} title={t('Đang tải Cleaner Unit Price…', 'Loading Cleaner Unit Price…')} />;
  if (error) return <InfoCard icon={<AlertTriangle className="h-5 w-5 text-rose-500" />} title={error} />;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <aside className="space-y-4 xl:col-span-4">
        <section className={`${card} overflow-hidden xl:sticky xl:top-24`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-cyan-50 to-white p-4 dark:border-slate-800 dark:from-cyan-950/20 dark:to-slate-900 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-500/20"><Receipt className="h-5 w-5" /></div>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-cyan-700 dark:text-cyan-300">Cleaner billing</p>
                <h2 className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">{t('Tạo Cleaner Invoice', 'Create Cleaner Invoice')}</h2>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              <InputField label={t('Invoice No', 'Invoice No')} value={draft.invoiceNo} onChange={value => setDraft(current => ({ ...current, invoiceNo: value }))} />
              <DateField label={t('Issue Date', 'Issue Date')} value={draft.issueDate} onChange={value => setDraft(current => ({ ...current, issueDate: value }))} />
              <MonthField label={t('Tháng dịch vụ', 'Service month')} value={draft.invoiceMonth} onChange={value => {
                const previousDefault = defaultInvoiceNo(draft.invoiceMonth);
                setDraft(current => ({
                  ...current,
                  invoiceMonth: value,
                  invoiceNo: current.invoiceNo === previousDefault ? defaultInvoiceNo(value) : current.invoiceNo,
                }));
              }} />
              <InputField label={t('Tên cleaner', 'Cleaner name')} value={draft.cleanerName} onChange={value => setDraft(current => ({ ...current, cleanerName: value }))} placeholder="Keanu" />
              <div className="col-span-2"><InputField label={t('Bill To / Client', 'Bill To / Client')} value={draft.clientName} onChange={value => setDraft(current => ({ ...current, clientName: value }))} placeholder="Nathan" /></div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div>
              <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{t('Tìm căn hộ', 'Find apartment')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setSelectedId(''); setUnitPrice(''); }}
                  placeholder={t('Gõ địa chỉ hoặc tên căn…', 'Search address or property name…')}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs"
                />
              </div>
              {query && !selectedId && (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                  {filteredRecords.slice(0, 8).map(record => (
                    <button key={record.id} type="button" onClick={() => selectApartment(record)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-cyan-50 dark:hover:bg-cyan-950/30">
                      <span className="min-w-0 flex-1 text-[9px] font-bold leading-4 text-slate-700 dark:text-slate-300">{record.apartment}</span>
                      <span className="shrink-0 text-[9px] font-extrabold text-cyan-700 dark:text-cyan-300">{formatCurrency(record.unitPrice)}</span>
                    </button>
                  ))}
                  {filteredRecords.length === 0 && <p className="p-3 text-center text-[9px] text-slate-400">{t('Không tìm thấy căn hộ.', 'No matching apartment.')}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t('Số shifts', 'Shifts')} value={shifts} min={1} step={1} onChange={value => setShifts(value === '' ? '' : Math.max(1, Math.floor(value)))} />
              <MoneyField label="Unit Price (AUD)" value={unitPrice} onChange={setUnitPrice} placeholder={selected?.unitPrice ? String(selected.unitPrice) : '0'} />
            </div>

            <div>
              <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Service dates</label>
              <input
                value={serviceDays}
                onChange={event => setServiceDays(event.target.value)}
                placeholder="01; 02; 13; 25"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-800 outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs"
              />
              <p className="mt-1.5 text-[9px] leading-4 text-slate-400">{t(
                `Nhập ngày trong tháng ${draft.invoiceMonth} và cách nhau bằng dấu “;”. Ví dụ: 01; 02; 13; 25`,
                `Enter days in ${draft.invoiceMonth}, separated by “;”. Example: 01; 02; 13; 25`,
              )}</p>
              {serviceDays && (
                <div className={`mt-2 flex items-start gap-2 rounded-xl border p-2.5 text-[9px] font-bold leading-4 ${
                  serviceCountMatches
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                }`}>
                  {serviceCountMatches ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{serviceCountMatches
                    ? t(`${parsedDays.tokenCount} ngày = ${shifts} shifts. Khớp.`, `${parsedDays.tokenCount} dates = ${shifts} shifts. Match.`)
                    : parsedDays.invalid.length
                      ? t(`Ngày không hợp lệ: ${parsedDays.invalid.join(', ')}. Hãy kiểm tra lại.`, `Invalid date(s): ${parsedDays.invalid.join(', ')}. Please check.`)
                      : t(`Bạn nhập ${shifts} shifts nhưng có ${parsedDays.tokenCount} service dates. Hãy kiểm tra lại.`, `You entered ${shifts} shifts but ${parsedDays.tokenCount} service dates. Please check.`)
                  }</span>
                </div>
              )}
            </div>

            <button type="button" onClick={addToInvoice} disabled={!selected || !serviceCountMatches || !Number(unitPrice)} className={`${button} h-11 w-full bg-cyan-600 px-4 text-[10px] text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-700`}>
              <Plus className="h-4 w-4" /> Add to Invoice
            </button>

            {notice && <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[9px] font-bold leading-4 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">{notice}</div>}
          </div>
        </section>
      </aside>

      <main className="space-y-4 xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-cyan-700 dark:text-cyan-300">Live invoice preview</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">{draft.invoiceNo || 'Cleaner Invoice'}</h2>
            <p className="mt-1 text-[10px] text-slate-500">{totalShifts} {t('shifts', 'shifts')} · {formatCurrency(grandTotal)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton label={exporting === 'copy' ? t('Đang copy…', 'Copying…') : t('Copy Invoice', 'Copy Invoice')} icon={exporting === 'copy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void runExport('copy')} disabled={Boolean(exporting)} />
            <ExportButton label={exporting === 'share' ? t('Đang share…', 'Sharing…') : t('Share Invoice', 'Share Invoice')} icon={exporting === 'share' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} onClick={() => void runExport('share')} disabled={Boolean(exporting)} />
            <ExportButton label="PNG" icon={<ImageDown className="h-3.5 w-3.5" />} onClick={() => void runExport('png')} disabled={Boolean(exporting)} />
            <ExportButton label="PDF" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => void runExport('pdf')} disabled={Boolean(exporting)} />
            <button type="button" onClick={clearInvoice} className={`${button} h-10 border border-rose-200 bg-white px-3 text-[9px] text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300`}><Trash2 className="h-3.5 w-3.5" />{t('Xóa invoice', 'Clear')}</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:shadow-none">
          <InvoicePreview draft={draft} servicePeriod={servicePeriod} grandTotal={grandTotal} totalShifts={totalShifts} onRemove={removeLine} />
        </div>
      </main>
    </div>
  );
}

function InvoicePreview({ draft, servicePeriod, grandTotal, totalShifts, onRemove }: {
  draft: InvoiceDraft;
  servicePeriod: string;
  grandTotal: number;
  totalShifts: number;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="min-w-[680px] bg-white p-7 text-slate-700 sm:p-9">
      <div className="flex items-start justify-between gap-6 border-b-2 border-blue-500 pb-5">
        <div>
          <h3 className="text-3xl font-extrabold tracking-tight text-[#183858]">INVOICE</h3>
          <p className="mt-2 text-xs font-medium text-slate-500">Professional Cleaning Services</p>
        </div>
        <div className="space-y-1 text-right text-[10px] leading-4 text-slate-500">
          <p><strong className="text-slate-700">Invoice No:</strong> {draft.invoiceNo || '—'}</p>
          <p><strong className="text-slate-700">Issue Date:</strong> {draft.issueDate ? formatDate(draft.issueDate) : '—'}</p>
          <p><strong className="text-slate-700">Service Period:</strong> {servicePeriod}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-blue-600">Cleaner (Service Provider)</p>
          <p className="mt-2 text-xs font-extrabold text-slate-800">{draft.cleanerName || '—'}</p>
          <p className="mt-1 text-[10px] text-slate-500">Residential & Property Cleaning Services</p>
        </div>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-blue-600">Bill To (Client)</p>
          <p className="mt-2 text-xs font-extrabold text-slate-800">{draft.clientName || '—'}</p>
          <p className="mt-1 text-[10px] text-slate-500">Property Management / Host</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[150px_minmax(280px,1fr)_70px_90px_100px_38px] items-center bg-[#2f73b7] px-3 py-3 text-[9px] font-extrabold uppercase tracking-wide text-white">
          <span>Service Date</span><span>Property Name - Address</span><span className="text-center">Shifts</span><span className="text-right">Unit Price</span><span className="text-right">Total</span><span />
        </div>
        {draft.lines.length ? draft.lines.map((line, index) => (
          <div key={line.id} className={`grid grid-cols-[150px_minmax(280px,1fr)_70px_90px_100px_38px] items-center gap-0 px-3 py-3 text-[10px] ${index % 2 ? 'bg-slate-50' : 'bg-white'} ${index ? 'border-t border-slate-200' : ''}`}>
            <span className="pr-3 text-[9px] leading-4 text-slate-500">{line.serviceDates.map(formatServiceDate).join('; ')}</span>
            <span className="pr-3 font-bold leading-4 text-slate-700">{line.apartment}</span>
            <span className="text-center">{line.shifts}</span>
            <span className="text-right">{formatCurrency(line.unitPrice)}</span>
            <span className="text-right font-extrabold text-slate-800">{formatCurrency(line.shifts * line.unitPrice)}</span>
            <button type="button" onClick={() => onRemove(line.id)} title="Remove line" className="ml-auto rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
          </div>
        )) : (
          <div className="p-10 text-center text-xs text-slate-400">Add cleaning shifts to build the invoice.</div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_240px] gap-5 border-t-2 border-blue-500 pt-4">
        <div className="rounded-lg bg-blue-50 p-3 text-[9px] leading-4 text-blue-900">
          <p className="font-extrabold">Shift Summary & Notes:</p>
          <p className="mt-1">Shifts are consolidated by property unit. Total of {totalShifts} cleaning shift{totalShifts === 1 ? '' : 's'} currently added to this invoice.</p>
        </div>
        <div className="space-y-2 text-[10px]">
          <div className="flex items-center justify-between text-slate-500"><span>Total Shifts:</span><strong className="text-slate-700">{totalShifts} shifts</strong></div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-[#183858]"><span>Grand Total:</span><span className="text-blue-600">{formatCurrency(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}

function CleanerUnitPriceManager({ records, loading, error, lang }: {
  records: PricingRecord[];
  loading: boolean;
  error: string;
  lang: Lang;
}) {
  const [query, setQuery] = useState('');
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const t = (vi: string, en: string) => pick(lang, vi, en);

  useEffect(() => {
    setDraftPrices(current => {
      const next = { ...current };
      for (const record of records) {
        if (!(record.id in next)) next[record.id] = record.unitPrice ? String(record.unitPrice) : '';
      }
      return next;
    });
  }, [records]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return records;
    return records.filter(record => normalize(record.apartment).includes(normalizedQuery));
  }, [query, records]);

  const savePrice = async (record: PricingRecord) => {
    const price = Number(draftPrices[record.id]);
    if (!Number.isFinite(price) || price <= 0) {
      setMessage(t('Cleaner Unit Price phải lớn hơn 0.', 'Cleaner Unit Price must be greater than 0.'));
      return;
    }
    setSavingId(record.id);
    setMessage('');
    try {
      await setDoc(doc(db, 'apartments', record.id), {
        cleanerUnitPrice: Math.round(price * 100) / 100,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || '',
      }, { merge: true });
      setMessage(t(`Đã lưu Cleaner Unit Price cho ${record.apartment}.`, `Cleaner Unit Price saved for ${record.apartment}.`));
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Unable to save Cleaner Unit Price.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="rounded-2xl border-2 border-cyan-200 bg-white p-4 shadow-sm dark:border-cyan-900 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"><DollarSign className="h-4.5 w-4.5" /></div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-cyan-600">Cleaner Invoice settings</p>
            <h3 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">Cleaner Unit Price</h3>
            <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">{t('Quản lý giá mặc định cho từng căn. Cleaner Invoice sẽ tự fill giá này, nhưng bạn vẫn có thể chỉnh Unit Price riêng cho từng invoice.', 'Manage the default price for each apartment. Cleaner Invoice auto-fills this amount, while each invoice line can still be adjusted.')}</p>
          </div>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Tìm căn hộ…', 'Find apartment…')} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 md:text-xs" />
        </label>
      </div>

      {message && <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 text-[9px] font-bold leading-4 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">{message}</div>}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-[10px] text-slate-500 dark:bg-slate-950"><Loader2 className="h-4 w-4 animate-spin" /> {t('Đang tải…', 'Loading…')}</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] font-bold text-rose-700">{error}</div>
      ) : (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {filtered.map(record => (
            <div key={record.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <Building2 className="h-4 w-4 shrink-0 text-cyan-600" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[9px] font-extrabold leading-4 text-slate-700 dark:text-slate-300">{record.apartment}</p>
                <p className="mt-0.5 text-[8px] text-slate-400">{record.storedUnitPrice == null ? t('Đang dùng giá mặc định từ danh sách ban đầu', 'Using the seeded default price') : t('Đã lưu trong Firebase', 'Saved in Firebase')}</p>
              </div>
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                <input type="number" min="0" step="5" value={draftPrices[record.id] ?? ''} onChange={event => setDraftPrices(current => ({ ...current, [record.id]: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-right text-xs font-extrabold outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <button type="button" onClick={() => void savePrice(record)} disabled={savingId === record.id} className={`${button} h-9 w-9 shrink-0 bg-cyan-600 text-white hover:bg-cyan-700`} title="Save Cleaner Unit Price">
                {savingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InputField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 md:text-xs" /></label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input type="date" value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-2 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" /></div></label>;
}

function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span><input type="month" value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function NumberField({ label, value, onChange, min, step }: { label: string; value: number | ''; onChange: (value: number | '') => void; min: number; step: number }) {
  return <label><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span><input type="number" min={min} step={step} value={value} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-extrabold outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 md:text-xs" /></label>;
}

function MoneyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span><div className="relative"><DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input type="number" min="0" step="5" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base font-extrabold outline-none focus:border-cyan-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 md:text-xs" /></div></label>;
}

function ExportButton({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${button} h-10 border border-slate-200 bg-white px-3 text-[9px] text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}>{icon}{label}</button>;
}

function InfoCard({ icon, title }: { icon: ReactNode; title: string }) {
  return <section className={`${card} flex items-center gap-3 p-6 text-sm font-bold text-slate-600 dark:text-slate-300`}>{icon}{title}</section>;
}

function safeFileName(value: string): string {
  return (value || 'cleaner-invoice').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'cleaner-invoice';
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to create invoice image.')), type, quality));
}

async function copyCanvas(canvas: HTMLCanvasElement, invoice: ExportInvoice): Promise<void> {
  const png = await canvasToBlob(canvas, 'image/png');
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return;
  }
  const text = [
    `INVOICE ${invoice.invoiceNo}`,
    `Cleaner: ${invoice.cleanerName}`,
    `Client: ${invoice.clientName}`,
    `Service period: ${invoice.servicePeriod}`,
    ...invoice.lines.map(line => `${line.serviceDates.map(formatServiceDate).join('; ')} | ${line.apartment} | ${line.shifts} shift(s) × ${formatCurrency(line.unitPrice)} = ${formatCurrency(line.shifts * line.unitPrice)}`),
    `Grand Total: ${formatCurrency(invoice.grandTotal)}`,
  ].join('\n');
  await navigator.clipboard.writeText(text);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
      else { lines.push(current); current = words[i]; }
    }
    lines.push(current);
  }
  return lines;
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 6): number {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length;
}

function renderInvoiceCanvas(invoice: ExportInvoice): HTMLCanvasElement {
  const width = 1240;
  const left = 76;
  const right = 76;
  const contentWidth = width - left - right;
  const headerHeight = 290;
  const tableHeaderHeight = 70;
  const footerHeight = 260;
  const rowMetrics = invoice.lines.map(line => {
    const propertyLines = Math.max(1, Math.ceil(line.apartment.length / 46));
    const dateLines = Math.max(1, Math.ceil(line.serviceDates.map(formatServiceDate).join('; ').length / 21));
    return Math.max(72, 30 + Math.max(propertyLines, dateLines) * 25);
  });
  const height = Math.max(1000, headerHeight + tableHeaderHeight + rowMetrics.reduce((sum, value) => sum + value, 0) + footerHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');

  const navy = '#173a5e';
  const blue = '#2f78bd';
  const text = '#44546a';
  const muted = '#6b778c';
  const line = '#dce4ec';
  const light = '#f3f7fa';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = navy;
  ctx.font = '800 56px Arial, sans-serif';
  ctx.fillText('INVOICE', left, 90);
  ctx.fillStyle = muted;
  ctx.font = '400 24px Arial, sans-serif';
  ctx.fillText('Professional Cleaning Services', left, 140);

  ctx.textAlign = 'right';
  ctx.fillStyle = text;
  ctx.font = '700 18px Arial, sans-serif';
  ctx.fillText(`Invoice No: ${invoice.invoiceNo || '—'}`, width - right, 62);
  ctx.font = '400 18px Arial, sans-serif';
  ctx.fillText(`Issue Date: ${invoice.issueDate ? formatDate(invoice.issueDate) : '—'}`, width - right, 96);
  ctx.fillText(`Service Period: ${invoice.servicePeriod}`, width - right, 130);
  ctx.textAlign = 'left';

  ctx.fillStyle = blue;
  ctx.fillRect(left, 176, contentWidth, 4);

  const infoY = 208;
  const infoH = 118;
  ctx.fillStyle = light;
  ctx.fillRect(left, infoY, contentWidth, infoH);
  const mid = left + contentWidth / 2;
  ctx.fillStyle = blue;
  ctx.font = '800 18px Arial, sans-serif';
  ctx.fillText('CLEANER (SERVICE PROVIDER):', left + 24, infoY + 34);
  ctx.fillText('BILL TO (CLIENT):', mid + 24, infoY + 34);
  ctx.fillStyle = text;
  ctx.font = '700 20px Arial, sans-serif';
  ctx.fillText(invoice.cleanerName || '—', left + 24, infoY + 70);
  ctx.fillText(invoice.clientName || '—', mid + 24, infoY + 70);
  ctx.fillStyle = muted;
  ctx.font = '400 16px Arial, sans-serif';
  ctx.fillText('Residential & Property Cleaning Services', left + 24, infoY + 96);
  ctx.fillText('Property Management / Host', mid + 24, infoY + 96);

  let y = 368;
  const cols = {
    date: { x: left, w: 230 },
    property: { x: left + 230, w: 455 },
    shifts: { x: left + 685, w: 110 },
    price: { x: left + 795, w: 140 },
    total: { x: left + 935, w: contentWidth - 935 },
  };
  ctx.fillStyle = blue;
  ctx.fillRect(left, y, contentWidth, tableHeaderHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 16px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('SERVICE DATE', cols.date.x + 14, y + tableHeaderHeight / 2);
  ctx.fillText('PROPERTY NAME - ADDRESS', cols.property.x + 14, y + tableHeaderHeight / 2);
  ctx.textAlign = 'center';
  ctx.fillText('SHIFTS', cols.shifts.x + cols.shifts.w / 2, y + tableHeaderHeight / 2);
  ctx.textAlign = 'right';
  ctx.fillText('UNIT PRICE', cols.price.x + cols.price.w - 14, y + tableHeaderHeight / 2);
  ctx.fillText('TOTAL', left + contentWidth - 14, y + tableHeaderHeight / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  y += tableHeaderHeight;

  invoice.lines.forEach((item, index) => {
    const rowH = rowMetrics[index];
    ctx.fillStyle = index % 2 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(left, y, contentWidth, rowH);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y + rowH);
    ctx.lineTo(left + contentWidth, y + rowH);
    ctx.stroke();

    const baseline = y + 30;
    ctx.fillStyle = muted;
    ctx.font = '400 16px Arial, sans-serif';
    drawWrappedText(ctx, item.serviceDates.map(formatServiceDate).join('; '), cols.date.x + 14, baseline, cols.date.w - 28, 23, 5);
    ctx.fillStyle = text;
    ctx.font = '700 17px Arial, sans-serif';
    drawWrappedText(ctx, item.apartment, cols.property.x + 14, baseline, cols.property.w - 28, 24, 5);
    ctx.textAlign = 'center';
    ctx.font = '400 17px Arial, sans-serif';
    ctx.fillText(String(item.shifts), cols.shifts.x + cols.shifts.w / 2, baseline);
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(item.unitPrice), cols.price.x + cols.price.w - 14, baseline);
    ctx.font = '800 17px Arial, sans-serif';
    ctx.fillText(formatCurrency(item.shifts * item.unitPrice), left + contentWidth - 14, baseline);
    ctx.textAlign = 'left';
    y += rowH;
  });

  y += 34;
  ctx.fillStyle = blue;
  ctx.fillRect(left, y, contentWidth, 3);
  y += 20;
  const notesW = 580;
  ctx.fillStyle = '#eaf5fc';
  ctx.fillRect(left, y, notesW, 112);
  ctx.fillStyle = navy;
  ctx.font = '800 16px Arial, sans-serif';
  ctx.fillText('Shift Summary & Notes:', left + 20, y + 30);
  ctx.fillStyle = text;
  ctx.font = '400 15px Arial, sans-serif';
  const totalShifts = invoice.lines.reduce((sum, item) => sum + item.shifts, 0);
  drawWrappedText(ctx, `Shifts are consolidated by property unit. Total of ${totalShifts} cleaning shift${totalShifts === 1 ? '' : 's'} added to this invoice.`, left + 20, y + 58, notesW - 40, 21, 3);

  const summaryX = left + contentWidth - 390;
  ctx.fillStyle = muted;
  ctx.font = '400 17px Arial, sans-serif';
  ctx.fillText('Total Shifts:', summaryX, y + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = text;
  ctx.font = '700 17px Arial, sans-serif';
  ctx.fillText(`${totalShifts} shifts`, left + contentWidth, y + 28);
  ctx.strokeStyle = blue;
  ctx.beginPath();
  ctx.moveTo(summaryX, y + 48);
  ctx.lineTo(left + contentWidth, y + 48);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = navy;
  ctx.font = '800 25px Arial, sans-serif';
  ctx.fillText('Grand Total:', summaryX, y + 90);
  ctx.textAlign = 'right';
  ctx.fillStyle = blue;
  ctx.fillText(formatCurrency(invoice.grandTotal), left + contentWidth, y + 90);
  ctx.textAlign = 'left';

  return canvas;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
  return output;
}

async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;
  const add = (value: string | Uint8Array) => {
    const chunk = typeof value === 'string' ? enc.encode(value) : value;
    chunks.push(chunk);
    byteLength += chunk.length;
  };
  const addObject = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = byteLength;
    add(`${id} 0 obj\n`);
    if (Array.isArray(body)) body.forEach(add);
    else add(body);
    add('\nendobj\n');
  };

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 22;
  const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const drawX = (pageW - drawW) / 2;
  const drawY = pageH - margin - drawH;
  const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  add('%PDF-1.4\n');
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  addObject(4, [
    enc.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    enc.encode('\nendstream'),
  ]);
  addObject(5, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);

  const xrefOffset = byteLength;
  add('xref\n0 6\n');
  add('0000000000 65535 f \n');
  for (let id = 1; id <= 5; id += 1) add(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
}
