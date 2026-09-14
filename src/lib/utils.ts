import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** عدد با ارقام فارسی و جداکننده هزارگان */
export function faNum(n: number | bigint): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

/** تاریخ شمسی کوتاه */
export function faDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/** تاریخ و ساعت شمسی */
export function faDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** ساخت اسلاگ از عنوان — حروف فارسی حفظ می‌شوند چون مرورگرها و گوگل از آن پشتیبانی می‌کنند */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[‌‏‎]/g, ' ') // نیم‌فاصله و نویسه‌های جهت
    .replace(/[^\p{L}\p{N}]+/gu, '-') // هر چیزی جز حرف و عدد → خط تیره
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

/** شمارش کلمات متن (بدون سینتکس مارک‌داون) */
export function countWords(text: string): number {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\[\]()!-]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.length;
}

/** زمان مطالعه به دقیقه — میانگین ۲۰۰ کلمه در دقیقه برای فارسی */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  QUEUED: 'در صف انتشار',
  SCHEDULED: 'زمان‌بندی‌شده',
  PUBLISHED: 'منتشرشده',
  ARCHIVED: 'بایگانی',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  QUEUED: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ARCHIVED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

/** روزهای هفته به ترتیب هفته ایرانی، با شماره getDay جاوااسکریپت */
export const WEEK_DAYS: { value: number; label: string }[] = [
  { value: 6, label: 'شنبه' },
  { value: 0, label: 'یکشنبه' },
  { value: 1, label: 'دوشنبه' },
  { value: 2, label: 'سه‌شنبه' },
  { value: 3, label: 'چهارشنبه' },
  { value: 4, label: 'پنجشنبه' },
  { value: 5, label: 'جمعه' },
];
