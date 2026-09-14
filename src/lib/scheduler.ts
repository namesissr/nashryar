import 'server-only';
import prisma from './prisma';
import { publishArticle } from './publisher';

/**
 * موتور زمان‌بندی انتشار.
 * هر دقیقه یک «تیک» اجرا می‌شود (از instrumentation.ts) و دو کار می‌کند:
 *   ۱) مقاله‌های SCHEDULED که زمانشان رسیده را منتشر می‌کند.
 *   ۲) طبق برنامه هر سایت (مثلاً ۳ مقاله در روز در بازه ۹ تا ۲۱)، از صف QUEUED
 *      همان سایت مقاله برمی‌دارد و منتشر می‌کند.
 * همه زمان‌ها به وقت محلی سرور محاسبه می‌شوند.
 */

export type TickResult = {
  scheduledPublished: string[];
  queuePublished: string[];
  errors: string[];
};

function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** ساعت‌های انتشار امروزِ یک سایت را برمی‌گرداند (دقیقه از نیمه‌شب، مرتب) */
export function slotsForSite(
  site: {
    autoPerDay: number;
    autoWindowStart: string;
    autoWindowEnd: string;
    autoMode: string;
    autoTimes: string;
  },
  dayOfWeek: number,
  autoDays: string
): number[] {
  const allowedDays = autoDays
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => !Number.isNaN(d));
  if (!allowedDays.includes(dayOfWeek)) return [];

  const perDay = Math.max(1, Math.min(24, site.autoPerDay));

  if (site.autoMode === 'times') {
    const times = site.autoTimes
      .split(/[,،]/)
      .map(parseHm)
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);
    return times.slice(0, perDay);
  }

  // حالت spread: پخش یکنواخت در بازه
  const start = parseHm(site.autoWindowStart) ?? 9 * 60;
  const end = parseHm(site.autoWindowEnd) ?? 21 * 60;
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (perDay === 1) return [from];
  const step = (to - from) / (perDay - 1);
  return Array.from({ length: perDay }, (_, i) => Math.round(from + i * step));
}

/** پیش‌نمایش برنامه امروز یک سایت برای UI */
export function todaysPlan(site: {
  autoPublishEnabled: boolean;
  autoPerDay: number;
  autoWindowStart: string;
  autoWindowEnd: string;
  autoDays: string;
  autoMode: string;
  autoTimes: string;
}): { time: string; passed: boolean }[] {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return slotsForSite(site, now.getDay(), site.autoDays).map((m) => ({
    time: fmtHm(m),
    passed: m <= minutesNow,
  }));
}

let ticking = false;

export async function runSchedulerTick(now = new Date()): Promise<TickResult> {
  const result: TickResult = { scheduledPublished: [], queuePublished: [], errors: [] };
  if (ticking) return result; // جلوگیری از اجرای همزمان
  ticking = true;
  try {
    // ---- ۱) مقاله‌های زمان‌بندی‌شده که موعدشان رسیده ----
    const due = await prisma.article.findMany({
      where: { status: 'SCHEDULED', publishedAt: { lte: now } },
      select: { id: true, title: true, site: { select: { hubSecret: true, name: true } } },
    });
    for (const a of due) {
      if (!a.site.hubSecret) {
        result.errors.push(`«${a.title}»: اتصال ${a.site.name} پیکربندی نشده`);
        continue;
      }
      const r = await publishArticle(a.id);
      if (r.ok) {
        result.scheduledPublished.push(a.title);
        await prisma.articleEvent.create({
          data: { articleId: a.id, kind: 'auto-published', detail: 'انتشار خودکار در زمان تعیین‌شده' },
        });
      } else {
        result.errors.push(`«${a.title}»: ${r.error}`);
      }
    }

    // ---- ۲) صف انتشار خودکار هر سایت ----
    const sites = await prisma.site.findMany({
      where: { autoPublishEnabled: true, enabled: true, NOT: { hubSecret: '' } },
    });

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    for (const site of sites) {
      const slots = slotsForSite(site, now.getDay(), site.autoDays);
      const dueSlots = slots.filter((m) => m <= minutesNow);
      if (dueSlots.length === 0) continue;

      // چند مقاله امروز به‌صورت خودکار از صف منتشر شده؟
      const publishedToday = await prisma.article.count({
        where: {
          siteId: site.id,
          autoPublished: true,
          publishedAt: { gte: startOfDay, lte: now },
        },
      });

      let missing = dueSlots.length - publishedToday;
      while (missing > 0) {
        const next = await prisma.article.findFirst({
          where: { siteId: site.id, status: 'QUEUED' },
          orderBy: [{ queuePosition: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true },
        });
        if (!next) break;

        // زمان انتشار = زمان واقعی الان؛ پرچم autoPublished برای شمارش روزانه
        await prisma.article.update({
          where: { id: next.id },
          data: { publishedAt: now, autoPublished: true },
        });
        const r = await publishArticle(next.id);
        if (r.ok) {
          await prisma.article.update({
            where: { id: next.id },
            data: { queuePosition: null },
          });
          await prisma.articleEvent.create({
            data: {
              articleId: next.id,
              kind: 'auto-published',
              detail: `انتشار خودکار از صف ${site.name} (${publishedToday + (dueSlots.length - missing) + 1} از ${slots.length} امروز)`,
            },
          });
          result.queuePublished.push(next.title);
          missing--;
        } else {
          // ناموفق: به صف برگردد ولی پرچم خودکار پاک شود تا شمارش خراب نشود؛
          // در تیک بعدی دوباره تلاش می‌شود.
          await prisma.article.update({
            where: { id: next.id },
            data: { autoPublished: false, publishedAt: null },
          });
          result.errors.push(`«${next.title}» (${site.name}): ${r.error}`);
          break; // با خطای اتصال، بقیه صف همین سایت را هم رها کن
        }
      }
    }
  } finally {
    ticking = false;
  }
  return result;
}

// ---- اجرای دوره‌ای داخل خود سرور ----
const globalScheduler = globalThis as unknown as { __nashryarScheduler?: ReturnType<typeof setInterval> };

export function startScheduler() {
  if (globalScheduler.__nashryarScheduler) return;
  globalScheduler.__nashryarScheduler = setInterval(() => {
    runSchedulerTick().then((r) => {
      const total = r.scheduledPublished.length + r.queuePublished.length;
      if (total > 0 || r.errors.length > 0) {
        console.log(
          `[زمان‌بند] منتشرشده: ${total}` + (r.errors.length ? ` — خطاها: ${r.errors.join(' | ')}` : '')
        );
      }
    });
  }, 60 * 1000);
  console.log('⏰ زمان‌بند نشریار فعال شد (هر ۶۰ ثانیه)');
}
