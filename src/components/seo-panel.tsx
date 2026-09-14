'use client';

import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Lightbulb, Copy } from 'lucide-react';
import { analyzeSeo, GROUP_LABELS, type SeoInput, type SeoGroup } from '@/lib/seo';
import { faNum, cn } from '@/lib/utils';

function Gauge({ value, label }: { value: number; label: string }) {
  const ring = value >= 80 ? 'text-emerald-500' : value >= 50 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[70px] w-[70px]">
        <svg viewBox="0 0 36 36" className="h-[70px] w-[70px] -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-slate-100 dark:text-slate-800"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 97.4} 97.4`}
            className={ring}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-extrabold ${ring}`}>
          {faNum(value)}
        </span>
      </div>
      <span className="text-xs font-bold text-slate-500">{label}</span>
    </div>
  );
}

export function SeoPanel({
  input,
  duplicateKeywords,
}: {
  input: SeoInput;
  /** مقاله‌های دیگری از همان سایت که همین کلیدواژه کانونی را دارند */
  duplicateKeywords?: { id: string; title: string }[];
}) {
  const result = useMemo(() => analyzeSeo(input), [input]);

  const groups: SeoGroup[] = ['keyword', 'meta', 'content', 'readability', 'media'];

  return (
    <div className="space-y-4">
      {/* دو امتیاز */}
      <div className="flex items-center justify-around">
        <Gauge value={result.score} label="امتیاز سئو" />
        <Gauge value={result.readability} label="خوانایی" />
      </div>
      <p className="text-center text-xs text-slate-400">
        {faNum(result.wordCount)} کلمه · {faNum(result.readingMinutes)} دقیقه مطالعه · تراکم کلیدواژه{' '}
        {faNum(Number(result.keywordDensity.toFixed(1)))}٪
      </p>

      {/* هشدار کلیدواژه تکراری */}
      {duplicateKeywords && duplicateKeywords.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 dark:border-rose-800 dark:bg-rose-900/20">
          <p className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
            <Copy size={13} />
            کلیدواژه تکراری در این سایت!
          </p>
          <p className="mt-1 text-rose-600 dark:text-rose-400">
            {faNum(duplicateKeywords.length)} مقاله دیگر همین کلیدواژه را دارد (
            {duplicateKeywords
              .slice(0, 2)
              .map((d) => `«${d.title}»`)
              .join('، ')}
            {duplicateKeywords.length > 2 ? ' و…' : ''}
            ). دو مقاله با یک کلیدواژه با هم رقابت می‌کنند (Keyword Cannibalization) — کلیدواژه متفاوتی انتخاب کنید.
          </p>
        </div>
      )}

      {/* پیشنهادهای بهبود */}
      {result.suggestions.length > 0 ? (
        <div className="rounded-xl bg-brand-50/70 p-3 dark:bg-brand-900/15">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-brand-700 dark:text-brand-300">
            <Lightbulb size={14} />
            پیشنهادها برای بهتر شدن سئو
          </p>
          <ol className="space-y-1.5 pr-1">
            {result.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-5">
                <span
                  className={cn(
                    'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    s.priority === 2 ? 'bg-rose-500' : 'bg-amber-400'
                  )}
                />
                <span className="text-slate-700 dark:text-slate-300">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 size={14} />
          آفرین! همه معیارهای سئو رعایت شده است.
        </p>
      )}

      {/* چک‌لیست گروه‌بندی‌شده */}
      <div className="space-y-1.5">
        {groups.map((g) => {
          const items = result.checks.filter((c) => c.group === g);
          if (items.length === 0) return null;
          const passed = items.filter((c) => c.status === 'pass').length;
          const allPass = passed === items.length;
          const anyFail = items.some((c) => c.status === 'fail');
          return (
            <details key={g} className="group rounded-xl border border-slate-200 dark:border-slate-800">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-bold [&::-webkit-details-marker]:hidden">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    allPass ? 'bg-emerald-500' : anyFail ? 'bg-rose-500' : 'bg-amber-400'
                  )}
                />
                <span className="flex-1">{GROUP_LABELS[g]}</span>
                <span className="text-slate-400">
                  {faNum(passed)}/{faNum(items.length)}
                </span>
              </summary>
              <ul className="space-y-1.5 border-t border-slate-100 p-3 dark:border-slate-800">
                {items.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-xs leading-5">
                    {c.status === 'pass' ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    ) : c.status === 'warn' ? (
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                    ) : (
                      <XCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    )}
                    <div>
                      <span className={c.status === 'pass' ? 'text-slate-600 dark:text-slate-300' : 'font-bold'}>
                        {c.label}
                      </span>
                      {c.detail && c.status !== 'pass' && <p className="text-slate-400">{c.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/** پیش‌نمایش نتیجه گوگل */
export function SerpPreview({
  title,
  description,
  baseUrl,
  slug,
}: {
  title: string;
  description: string;
  baseUrl: string;
  slug: string;
}) {
  const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-emerald-700 dark:text-emerald-400" dir="ltr">
        {host}/blog/{slug || '…'}
      </p>
      <p className="mt-1 truncate text-[15px] font-medium text-blue-700 dark:text-blue-400">
        {title || 'عنوان مقاله شما'}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
        {description || 'توضیحات متا اینجا نمایش داده می‌شود…'}
      </p>
    </div>
  );
}
