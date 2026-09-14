import 'server-only';

/**
 * سئوی سطح سایت — تنظیماتی که به کل وبلاگ یک سایت مربوط‌اند (نه یک مقاله)
 * و همراه بقیه تنظیمات وبلاگ به سایت مقصد فرستاده می‌شوند.
 */

export type SiteSeoConfig = {
  /** قالب عنوان صفحه مقاله؛ %s جای عنوان مقاله را می‌گیرد */
  titleTemplate?: string | null;
  /** تصویر پیش‌فرض اشتراک‌گذاری وقتی مقاله تصویر شاخص ندارد */
  defaultOgImage?: string | null;
  /** نام سازمان برای Schema.org و نویسنده پیش‌فرض */
  organizationName?: string | null;
  /** لوگوی سازمان برای Schema.org */
  organizationLogo?: string | null;
  /** شناسه توییتر/ایکس برای کارت اشتراک‌گذاری */
  twitterHandle?: string | null;
  /** کد تأیید مالکیت گوگل سرچ کنسول (فقط مقدار content) */
  googleVerification?: string | null;
  /** کل وبلاگ از موتورهای جستجو پنهان شود */
  blogNoindex?: boolean;
  /** افزودن مقاله‌ها به sitemap سایت */
  sitemapEnabled?: boolean;
  /** فعال بودن داده ساختاریافته Article */
  structuredData?: boolean;
};

export type SeoCheckRow = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  /** پیشنهاد عملی برای رفع */
  fix?: string;
};

export type SiteSeoReport = {
  checkedAt: string;
  score: number;
  checks: SeoCheckRow[];
  /** خلاصه‌ای از چیزی که واقعاً روی سایت دیده شد */
  facts: {
    blogUrl: string;
    blogStatus: number | null;
    sitemapUrl: string;
    sitemapStatus: number | null;
    sitemapHasBlog: boolean;
    robotsStatus: number | null;
    robotsAllowsBlog: boolean;
    robotsHasSitemap: boolean;
    sampleArticleUrl: string | null;
    sampleTitle: string | null;
    sampleDescription: string | null;
    sampleCanonical: string | null;
    sampleOgImage: string | null;
    sampleHasJsonLd: boolean;
    sampleH1Count: number | null;
    httpsOk: boolean;
    responseMs: number | null;
  };
};

async function fetchText(url: string, timeoutMs = 15000): Promise<{ status: number | null; text: string; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'NashryarSeoBot/1.0 (+نشریار)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { status: res.status, text, ms: Date.now() - started };
  } catch {
    return { status: null, text: '', ms: Date.now() - started };
  }
}

function meta(html: string, attr: 'name' | 'property', key: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

/**
 * بررسی فنی سئوی یک سایت — صفحات واقعی وبلاگ، sitemap و robots را می‌خواند.
 * چیزی را تغییر نمی‌دهد؛ فقط گزارش می‌دهد.
 */
export async function runSiteSeoReport(
  baseUrl: string,
  sampleSlug: string | null
): Promise<SiteSeoReport> {
  const base = baseUrl.replace(/\/$/, '');
  const blogUrl = `${base}/blog`;
  const sitemapUrl = `${base}/sitemap.xml`;
  const robotsUrl = `${base}/robots.txt`;
  const sampleArticleUrl = sampleSlug ? `${base}/blog/${encodeURI(sampleSlug)}` : null;

  const [blog, sitemap, robots, sample] = await Promise.all([
    fetchText(blogUrl),
    fetchText(sitemapUrl),
    fetchText(robotsUrl),
    sampleArticleUrl ? fetchText(sampleArticleUrl) : Promise.resolve({ status: null, text: '', ms: null as number | null }),
  ]);

  const checks: SeoCheckRow[] = [];
  const add = (id: string, label: string, status: SeoCheckRow['status'], detail: string, fix?: string) =>
    checks.push({ id, label, status, detail, fix });

  // ---- دسترسی و سرعت ----
  const httpsOk = base.startsWith('https://');
  add(
    'https',
    'اتصال امن (HTTPS)',
    httpsOk ? 'pass' : 'fail',
    httpsOk ? 'آدرس سایت با https است.' : 'آدرس سایت با http ثبت شده است.',
    'گواهی TLS نصب و آدرس سایت را در بخش «سایت‌ها» با https ثبت کنید.'
  );

  add(
    'blog-up',
    'در دسترس بودن صفحه وبلاگ',
    blog.status === 200 ? 'pass' : 'fail',
    blog.status === 200 ? `${blogUrl} با کد ۲۰۰ پاسخ داد.` : `پاسخ ${blog.status ?? 'بدون پاسخ'} از ${blogUrl}`,
    'مطمئن شوید سرویس سایت بالاست و مسیر /blog روی آن فعال است.'
  );

  if (blog.status === 200) {
    const fast = blog.ms < 1500;
    add(
      'speed',
      'زمان پاسخ صفحه وبلاگ',
      fast ? 'pass' : blog.ms < 3000 ? 'warn' : 'fail',
      `${blog.ms} میلی‌ثانیه`,
      'کش سمت سرور یا CDN فعال کنید؛ گوگل سرعت را مستقیم در رتبه لحاظ می‌کند.'
    );
  }

  // ---- robots.txt ----
  const robotsText = robots.text;
  const robotsOk = robots.status === 200;
  const robotsBlocksBlog = /^\s*Disallow:\s*\/blog/im.test(robotsText);
  const robotsHasSitemap = /^\s*Sitemap:\s*\S+/im.test(robotsText);
  add(
    'robots',
    'فایل robots.txt',
    robotsOk ? 'pass' : 'warn',
    robotsOk ? 'موجود است.' : 'یافت نشد یا خطا داد.',
    'یک robots.txt در ریشه دامنه قرار دهید و آدرس sitemap را در آن معرفی کنید.'
  );
  if (robotsOk) {
    add(
      'robots-blog',
      'اجازه خزیدن مسیر وبلاگ',
      robotsBlocksBlog ? 'fail' : 'pass',
      robotsBlocksBlog ? 'مسیر /blog در robots.txt مسدود شده است!' : 'مسیر /blog مسدود نشده است.',
      'خط Disallow مربوط به /blog را از robots.txt بردارید.'
    );
    add(
      'robots-sitemap',
      'معرفی sitemap در robots.txt',
      robotsHasSitemap ? 'pass' : 'warn',
      robotsHasSitemap ? 'آدرس sitemap معرفی شده است.' : 'آدرس sitemap در robots.txt نیست.',
      `خط «Sitemap: ${sitemapUrl}» را به robots.txt اضافه کنید.`
    );
  }

  // ---- sitemap ----
  const sitemapOk = sitemap.status === 200 && /<urlset|<sitemapindex/i.test(sitemap.text);
  const sitemapHasBlog = /\/blog/i.test(sitemap.text);
  add(
    'sitemap',
    'نقشه سایت (sitemap.xml)',
    sitemapOk ? 'pass' : 'warn',
    sitemapOk ? 'موجود و معتبر است.' : `پاسخ ${sitemap.status ?? 'بدون پاسخ'} یا قالب نامعتبر.`,
    'نقشه سایت را فعال کنید تا گوگل صفحات تازه را سریع‌تر پیدا کند.'
  );
  if (sitemapOk) {
    add(
      'sitemap-blog',
      'حضور مقاله‌ها در نقشه سایت',
      sitemapHasBlog ? 'pass' : 'warn',
      sitemapHasBlog ? 'آدرس‌های وبلاگ در نقشه سایت هستند.' : 'هیچ آدرس /blog در نقشه سایت نیست.',
      'مقاله‌های منتشرشده باید در sitemap بیایند؛ پس از انتشار اولین مقاله دوباره بررسی کنید.'
    );
  }

  // ---- نمونه مقاله ----
  let sampleTitle: string | null = null;
  let sampleDescription: string | null = null;
  let sampleCanonical: string | null = null;
  let sampleOgImage: string | null = null;
  let sampleHasJsonLd = false;
  let sampleH1Count: number | null = null;

  if (sample.status === 200 && sample.text) {
    const html = sample.text;
    sampleTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
    sampleDescription = meta(html, 'name', 'description');
    sampleCanonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0]?.match(/href=["']([^"']*)["']/i)?.[1] ?? null;
    sampleOgImage = meta(html, 'property', 'og:image');
    sampleHasJsonLd = /application\/ld\+json/i.test(html);
    sampleH1Count = (html.match(/<h1[\s>]/gi) || []).length;
    const robotsMeta = meta(html, 'name', 'robots') || '';

    add(
      'article-title',
      'عنوان صفحه مقاله',
      sampleTitle && sampleTitle.length >= 10 ? 'pass' : 'fail',
      sampleTitle ? `«${sampleTitle.slice(0, 70)}»` : 'تگ title پیدا نشد.',
      'مطمئن شوید صفحه مقاله عنوان اختصاصی می‌گیرد، نه عنوان کلی سایت.'
    );
    add(
      'article-desc',
      'توضیحات متا صفحه مقاله',
      sampleDescription && sampleDescription.length >= 50 ? 'pass' : 'warn',
      sampleDescription ? `${sampleDescription.length} نویسه` : 'meta description پیدا نشد.',
      'در ویرایشگر مقاله، فیلد «توضیحات متا» را پر کنید.'
    );
    add(
      'article-canonical',
      'آدرس canonical',
      sampleCanonical ? 'pass' : 'warn',
      sampleCanonical ? sampleCanonical : 'تگ canonical پیدا نشد.',
      'canonical از محتوای تکراری جلوگیری می‌کند؛ در صفحه مقاله تنظیمش کنید.'
    );
    add(
      'article-og',
      'تصویر اشتراک‌گذاری (og:image)',
      sampleOgImage ? 'pass' : 'warn',
      sampleOgImage ? 'تنظیم شده است.' : 'og:image پیدا نشد.',
      'برای مقاله تصویر شاخص بگذارید یا در همین صفحه «تصویر پیش‌فرض اشتراک‌گذاری» را تعیین کنید.'
    );
    add(
      'article-jsonld',
      'داده ساختاریافته (Schema.org)',
      sampleHasJsonLd ? 'pass' : 'warn',
      sampleHasJsonLd ? 'JSON-LD در صفحه هست.' : 'JSON-LD پیدا نشد.',
      'گزینه «داده ساختاریافته» را در همین صفحه روشن کنید تا مقاله‌ها در نتایج غنی دیده شوند.'
    );
    add(
      'article-h1',
      'تیتر اصلی (H1)',
      sampleH1Count === 1 ? 'pass' : 'warn',
      `${sampleH1Count} تگ H1 در صفحه`,
      'هر صفحه باید دقیقاً یک H1 داشته باشد که همان عنوان مقاله است.'
    );
    if (/noindex/i.test(robotsMeta)) {
      add(
        'article-noindex',
        'وضعیت ایندکس مقاله',
        'fail',
        'این مقاله noindex است و در گوگل نمایش داده نمی‌شود!',
        'اگر عمدی نیست، تیک noindex را در تنظیمات مقاله یا سایت بردارید.'
      );
    } else {
      add('article-noindex', 'وضعیت ایندکس مقاله', 'pass', 'قابل ایندکس است.');
    }
  } else if (sampleArticleUrl) {
    add(
      'article-up',
      'در دسترس بودن صفحه مقاله',
      'fail',
      `پاسخ ${sample.status ?? 'بدون پاسخ'} از ${sampleArticleUrl}`,
      'مقاله ممکن است روی سایت منتشر نشده باشد؛ از بخش مقاله‌ها دوباره منتشرش کنید.'
    );
  } else {
    add(
      'article-none',
      'نمونه مقاله برای بررسی',
      'warn',
      'هنوز مقاله منتشرشده‌ای روی این سایت نیست.',
      'یک مقاله منتشر کنید تا بررسی‌های سطح صفحه هم انجام شود.'
    );
  }

  const weight = (s: SeoCheckRow['status']) => (s === 'pass' ? 1 : s === 'warn' ? 0.5 : 0);
  const score = checks.length ? Math.round((checks.reduce((a, c) => a + weight(c.status), 0) / checks.length) * 100) : 0;

  return {
    checkedAt: new Date().toISOString(),
    score,
    checks,
    facts: {
      blogUrl,
      blogStatus: blog.status,
      sitemapUrl,
      sitemapStatus: sitemap.status,
      sitemapHasBlog,
      robotsStatus: robots.status,
      robotsAllowsBlog: !robotsBlocksBlog,
      robotsHasSitemap,
      sampleArticleUrl,
      sampleTitle,
      sampleDescription,
      sampleCanonical,
      sampleOgImage,
      sampleHasJsonLd,
      sampleH1Count,
      httpsOk,
      responseMs: blog.status ? blog.ms : null,
    },
  };
}
