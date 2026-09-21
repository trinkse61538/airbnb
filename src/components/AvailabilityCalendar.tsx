import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { useUiLanguage } from '../i18n';

const CALENDAR_API =
  'https://airbnb-availability-api.khaitri15.workers.dev/calendar';

interface CalendarEvent {
  from: string;
  to: string;
}

interface CalendarListing {
  id: string;
  name: string;
  events: CalendarEvent[];
  error?: string;
}

interface CalendarResponse {
  query: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    total: number;
    errors: number;
  };
  results: CalendarListing[];
  fetchedAt: string;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseUtcDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: string, amount: number) {
  const date = parseUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function buildDates(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

function eventCoversDay(event: CalendarEvent, day: string) {
  return event.from <= day && day < event.to;
}

export default function AvailabilityCalendar() {
  const { language, text } = useUiLanguage();
  const today = useMemo(() => toDateKey(new Date()), []);

  const [startDate, setStartDate] = useState(today);
  const [rangeDays, setRangeDays] = useState(14);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const dates = useMemo(
    () => buildDates(startDate, rangeDays),
    [startDate, rangeDays]
  );

  const endExclusive = useMemo(
    () => addDays(startDate, rangeDays),
    [startDate, rangeDays]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          from: startDate,
          to: endExclusive
        });

        const response = await fetch(`${CALENDAR_API}?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json'
          }
        });

        const payload = (await response.json()) as CalendarResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            'error' in payload && payload.error
              ? payload.error
              : text('Không thể tải lịch tổng quan.', 'Unable to load calendar overview.')
          );
        }

        if (!cancelled) {
          setData(payload as CalendarResponse);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message ||
              text(
                'Không thể kết nối tới API lịch.',
                'Could not connect to the calendar API.'
              )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [startDate, endExclusive, refreshKey]);

  const formatDayHeader = (value: string) => {
    const date = parseUtcDate(value);
    return {
      weekday: date.toLocaleDateString(
        language === 'vi' ? 'vi-VN' : 'en-AU',
        { weekday: 'short', timeZone: 'UTC' }
      ),
      day: date.toLocaleDateString(
        language === 'vi' ? 'vi-VN' : 'en-AU',
        { day: '2-digit', month: '2-digit', timeZone: 'UTC' }
      )
    };
  };

  const formatLongDate = (value: string) =>
    parseUtcDate(value).toLocaleDateString(
      language === 'vi' ? 'vi-VN' : 'en-AU',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      }
    );

  const periodEnd = addDays(startDate, rangeDays - 1);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                {text('Lịch tổng quan tất cả căn', 'All-listings calendar')}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                {formatLongDate(startDate)} → {formatLongDate(periodEnd)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStartDate(today)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {text('Hôm nay', 'Today')}
            </button>

            <button
              type="button"
              onClick={() => setStartDate(addDays(startDate, -rangeDays))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={text('Khoảng trước', 'Previous range')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value || today)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[16px] font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:text-xs"
            />

            <button
              type="button"
              onClick={() => setStartDate(addDays(startDate, rangeDays))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={text('Khoảng sau', 'Next range')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="flex h-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`rounded-lg px-3 text-[10px] font-extrabold transition ${
                    rangeDays === days
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-700 disabled:opacity-60"
              aria-label={text('Làm mới', 'Refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950" />
            {text('Trống', 'Available')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-rose-400 bg-rose-500" />
            {text('Đã có lịch / bị chặn', 'Unavailable / blocked')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-amber-400 bg-amber-100 dark:bg-amber-950" />
            {text('Không đọc được lịch', 'Calendar error')}
          </span>
          {data && (
            <span className="ml-auto">
              {data.summary.total} {text('căn', 'listings')} · {data.summary.errors} {text('lỗi', 'errors')}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading && !data ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-600" />
            <p className="text-xs font-bold">{text('Đang tải lịch...', 'Loading calendars...')}</p>
          </div>
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="min-w-max border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[230px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {text('Căn hộ', 'Listing')}
                  </th>

                  {dates.map((date) => {
                    const header = formatDayHeader(date);
                    const isToday = date === today;

                    return (
                      <th
                        key={date}
                        className={`sticky top-0 z-20 w-[58px] min-w-[58px] border-b border-r border-slate-200 px-1 py-2 text-center dark:border-slate-700 ${
                          isToday
                            ? 'bg-cyan-100 dark:bg-cyan-950/60'
                            : 'bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        <div className={`text-[9px] font-extrabold uppercase ${isToday ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-400'}`}>
                          {header.weekday}
                        </div>
                        <div className={`mt-0.5 text-[10px] font-black ${isToday ? 'text-cyan-800 dark:text-cyan-200' : 'text-slate-700 dark:text-slate-200'}`}>
                          {header.day}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {data.results.map((listing, rowIndex) => (
                  <tr key={listing.id}>
                    <th
                      className={`sticky left-0 z-10 min-w-[230px] max-w-[230px] border-b border-r border-slate-200 px-3 py-2.5 align-middle dark:border-slate-700 ${
                        rowIndex % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50 dark:bg-slate-900/95'
                      }`}
                    >
                      <div className="truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-100" title={listing.name}>
                        {listing.name}
                      </div>
                      {listing.error && (
                        <div className="mt-1 truncate text-[9px] font-semibold text-amber-600 dark:text-amber-400" title={listing.error}>
                          {listing.error}
                        </div>
                      )}
                    </th>

                    {dates.map((date) => {
                      const occupiedEvents = listing.events.filter((event) =>
                        eventCoversDay(event, date)
                      );
                      const occupied = occupiedEvents.length > 0;
                      const isToday = date === today;
                      const cellTitle = listing.error
                        ? `${listing.name}: ${listing.error}`
                        : occupied
                          ? `${listing.name} — ${text('Không trống', 'Unavailable')}: ${occupiedEvents
                              .map((event) => `${formatLongDate(event.from)} → ${formatLongDate(event.to)}`)
                              .join(' · ')}`
                          : `${listing.name} — ${text('Trống', 'Available')} — ${formatLongDate(date)}`;

                      return (
                        <td
                          key={date}
                          className={`border-b border-r border-slate-200 p-1 dark:border-slate-700 ${
                            isToday ? 'bg-cyan-50/60 dark:bg-cyan-950/10' : ''
                          }`}
                        >
                          <div
                            title={cellTitle}
                            className={`mx-auto flex h-9 w-[48px] items-center justify-center rounded-lg border text-[9px] font-black transition ${
                              listing.error
                                ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : occupied
                                  ? 'border-rose-500 bg-rose-500 text-white shadow-sm shadow-rose-200 dark:shadow-none'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
                            } ${isToday ? 'ring-2 ring-cyan-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                          >
                            {listing.error ? '!' : occupied ? 'BUSY' : 'FREE'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="min-h-64 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {text('Chưa có dữ liệu lịch.', 'No calendar data yet.')}
          </div>
        )}
      </div>

      {data && (
        <p className="text-right text-[9px] text-slate-400 dark:text-slate-500">
          {text('Cập nhật lúc', 'Fetched')}: {new Date(data.fetchedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-AU')}
        </p>
      )}
    </section>
  );
}
