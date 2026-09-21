import { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react';
import { useUiLanguage } from '../i18n';

const AVAILABILITY_API =
  'https://airbnb-availability-api.khaitri15.workers.dev/availability';

interface AvailabilityConflict {
  from: string;
  to: string;
}

interface AvailabilityItem {
  id: string;
  name: string;
  available: boolean | null;
  conflicts?: AvailabilityConflict[];
  error?: string;
}

interface AvailabilityResponse {
  query: {
    checkin: string;
    checkout: string;
  };
  summary: {
    total: number;
    available: number;
    unavailable: number;
    errors: number;
  };
  results: AvailabilityItem[];
  fetchedAt: string;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeDefaultDates() {
  const checkin = new Date();
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 1);

  return {
    checkin: toDateInputValue(checkin),
    checkout: toDateInputValue(checkout)
  };
}

function countNights(checkin: string, checkout: string) {
  const start = new Date(`${checkin}T00:00:00`);
  const end = new Date(`${checkout}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

export default function AvailabilityChecker() {
  const { language, text } = useUiLanguage();
  const defaults = useMemo(() => makeDefaultDates(), []);

  const [checkin, setCheckin] = useState(defaults.checkin);
  const [checkout, setCheckout] = useState(defaults.checkout);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(
      language === 'vi' ? 'vi-VN' : 'en-AU',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setData(null);

    if (!checkin || !checkout) {
      setError(text('Vui lòng chọn ngày nhận và trả phòng.', 'Please select check-in and check-out dates.'));
      return;
    }

    if (checkout <= checkin) {
      setError(text('Ngày trả phòng phải sau ngày nhận phòng.', 'Check-out must be after check-in.'));
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ checkin, checkout });
      const response = await fetch(`${AVAILABILITY_API}?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = (await response.json()) as AvailabilityResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          'error' in payload && payload.error
            ? payload.error
            : text('Không thể kiểm tra lịch Airbnb.', 'Unable to check Airbnb availability.')
        );
      }

      setData(payload as AvailabilityResponse);
    } catch (err: any) {
      setError(
        err?.message ||
          text(
            'Không thể kết nối tới API kiểm tra lịch.',
            'Could not connect to the availability API.'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const available = data?.results.filter((item) => item.available === true) ?? [];
  const unavailable = data?.results.filter((item) => item.available === false) ?? [];
  const unknown = data?.results.filter((item) => item.available === null) ?? [];
  const nights = checkin && checkout && checkout > checkin ? countNights(checkin, checkout) : 0;

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                <CalendarDays className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                  {text('Kiểm tra căn trống Airbnb', 'Airbnb Availability')}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                  {text(
                    'Chọn khoảng thời gian để kiểm tra tất cả lịch Airbnb cùng lúc.',
                    'Choose a stay period to check all Airbnb calendars at once.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-[1fr_1fr_auto]"
          >
            <label className="space-y-1.5">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {text('Nhận phòng', 'Check-in')}
              </span>
              <input
                type="date"
                value={checkin}
                onChange={(event) => setCheckin(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[16px] font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950 sm:text-sm"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {text('Trả phòng', 'Check-out')}
              </span>
              <input
                type="date"
                min={checkin || undefined}
                value={checkout}
                onChange={(event) => setCheckout(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[16px] font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950 sm:text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-600 px-5 text-xs font-extrabold text-white shadow-md shadow-indigo-200/50 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? text('Đang kiểm tra...', 'Checking...') : text('Kiểm tra căn trống', 'Check availability')}
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {nights > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              {nights} {text('đêm', nights === 1 ? 'night' : 'nights')}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
            {text('Nguồn: Airbnb iCal qua Cloudflare Worker', 'Source: Airbnb iCal via Cloudflare Worker')}
          </span>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                {text('Tổng số căn', 'Total listings')}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{data.summary.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {text('Còn trống', 'Available')}
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {data.summary.available}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400">
                {text('Đã bận', 'Unavailable')}
              </p>
              <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-300">
                {data.summary.unavailable}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {text('Không xác định', 'Errors')}
              </p>
              <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">
                {data.summary.errors}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                    {text('Căn đang trống', 'Available listings')}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  {available.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {available.length > 0 ? (
                  available.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {text('Không có căn nào trống trong khoảng này.', 'No listings are available for this period.')}
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white dark:border-rose-900/60 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-4 py-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-xs font-extrabold text-rose-800 dark:text-rose-200">
                    {text('Căn đã có lịch', 'Unavailable listings')}
                  </h3>
                </div>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  {unavailable.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {unavailable.map((item) => (
                  <div key={item.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                        {item.conflicts && item.conflicts.length > 0 && (
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {text('Đang bận:', 'Occupied:')}{' '}
                            {item.conflicts
                              .map((conflict) => `${formatDate(conflict.from)} → ${formatDate(conflict.to)}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {unknown.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-extrabold text-amber-800 dark:text-amber-200">
                  {text('Không thể xác minh', 'Unable to verify')}
                </h3>
              </div>
              <div className="space-y-2">
                {unknown.map((item) => (
                  <div key={item.id} className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold">{item.name}</span>
                    {item.error ? <span className="opacity-80"> — {item.error}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-right text-[9px] text-slate-400 dark:text-slate-500">
            {text('Cập nhật lúc', 'Fetched')}: {new Date(data.fetchedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-AU')}
          </p>
        </>
      )}
    </section>
  );
}
