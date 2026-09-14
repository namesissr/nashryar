/**
 * موتور تحلیل سئو — مثل Yoast اما فارسی.
 * هم در مرورگر (پیش‌نمایش زنده هنگام نوشتن) و هم در سرور (ذخیره امتیاز و ممیزی) اجرا می‌شود.
 * دو امتیاز جدا می‌دهد: «سئو» و «خوانایی» + فهرست پیشنهادهای عملی برای بهتر شدن.
 */

export type SeoCheckStatus = 'pass' | 'warn' | 'fail';
export type SeoGroup = 'keyword' | 'meta' | 'content' | 'readability' | 'media';

export const GROUP_LABELS: Record<SeoGroup, string> = {
  keyword: 'کلیدواژه کانونی',
  meta: 'عنوان و متا',
  content: 'محتوا و ساختار',
  readability: 'خوانایی',
  media: 'تصویر و پیوند',
};

export type SeoCheck = {
  id: string;
  group: SeoGroup;
  label: string;
  status: SeoCheckStatus;
  detail?: string;
  /** پیشنهاد عملی برای رفع مشکل — در بخش «پیشنهادها» نمایش داده می‌شود */
  suggestion?: string;
  weight: number;
};

export type SeoInput = {
  title: string;
  slug: string;
  excerpt: string;
  contentMd: string;
  focusKeyword: string;
  seoTitle: string;
  seoDescription: string;
  coverUrl: string;
  coverAlt: string;
  /** میزبان سایت مقصد (مثل arzinoo.com) برای تشخیص پیوند داخلی از خارجی */
  siteHost?: string;
};

export type SeoResult = {
  score: number; // امتیاز سئو ۰ تا ۱۰۰
  readability: number; // امتیاز خوانایی ۰ تا ۱۰۰
  checks: SeoCheck[];
  suggestions: { text: string; priority: number }[];
  wordCount: number;
  readingMinutes: number;
  keywordDensity: number;
};

function normalize(s: string): string {
  return s
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‏‎]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripMd(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

export function analyzeSeo(input: SeoInput): SeoResult {
  const checks: SeoCheck[] = [];
  const kw = normalize(input.focusKeyword);
  const title = normalize(input.seoTitle || input.title);
  const plainContent = normalize(stripMd(input.contentMd));
  const words = plainContent.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  const add = (
    id: string,
    group: SeoGroup,
    label: string,
    status: SeoCheckStatus,
    weight: number,
    detail?: string,
    suggestion?: string
  ) => checks.push({ id, group, label, status, weight, detail, suggestion: suggestion ?? detail });

  // ================= کلیدواژه =================
  if (!kw) {
    add(
      'kw',
      'keyword',
      'کلیدواژه کانونی تعیین نشده است',
      'fail',
      3,
      'برای تحلیل دقیق، کلیدواژه اصلی مقاله را وارد کنید.',
      'یک کلیدواژه کانونی تعیین کنید — عبارتی که کاربر در گوگل جستجو می‌کند (مثلاً «خرید بیت‌کوین»).'
    );
  } else {
    add('kw', 'keyword', 'کلیدواژه کانونی تعیین شده', 'pass', 1);

    const inTitle = title.includes(kw);
    add(
      'kw-title',
      'keyword',
      'کلیدواژه در عنوان',
      inTitle ? 'pass' : 'fail',
      3,
      inTitle ? undefined : 'عنوان سئو باید شامل کلیدواژه کانونی باشد.',
      'کلیدواژه کانونی را داخل عنوان سئو بیاورید — مهم‌ترین سیگنال رتبه‌بندی گوگل است.'
    );

    if (inTitle) {
      const atStart = title.indexOf(kw) <= Math.max(10, Math.floor(title.length * 0.3));
      add(
        'kw-title-start',
        'keyword',
        atStart ? 'کلیدواژه در ابتدای عنوان است' : 'کلیدواژه در انتهای عنوان است',
        atStart ? 'pass' : 'warn',
        1,
        atStart ? undefined : 'هرچه کلیدواژه به ابتدای عنوان نزدیک‌تر باشد، وزن بیشتری می‌گیرد.',
        'کلیدواژه را به ابتدای عنوان سئو منتقل کنید.'
      );
    }

    const slugNorm = normalize(input.slug.replace(/-/g, ' '));
    add(
      'kw-slug',
      'keyword',
      'کلیدواژه در نشانی (اسلاگ)',
      slugNorm.includes(kw) ? 'pass' : 'warn',
      2,
      slugNorm.includes(kw) ? undefined : 'بهتر است اسلاگ شامل کلیدواژه باشد.',
      'اسلاگ را طوری بازنویسی کنید که کلیدواژه کانونی در آن باشد.'
    );

    const firstPara = normalize(stripMd(input.contentMd.split(/\n\s*\n/)[0] || ''));
    add(
      'kw-intro',
      'keyword',
      'کلیدواژه در پاراگراف اول',
      firstPara.includes(kw) ? 'pass' : 'warn',
      2,
      firstPara.includes(kw) ? undefined : 'کلیدواژه را در همان ابتدای مقاله به کار ببرید.',
      'کلیدواژه کانونی را در پاراگراف اول مقاله بیاورید تا گوگل موضوع را سریع بفهمد.'
    );

    const headings = (input.contentMd.match(/^#{2,4}\s.+$/gm) || []).map(normalize).join(' ');
    add(
      'kw-heading',
      'keyword',
      'کلیدواژه در زیرعنوان‌ها',
      headings.includes(kw) ? 'pass' : 'warn',
      1,
      headings.includes(kw) ? undefined : 'دست‌کم یکی از زیرعنوان‌ها (##) شامل کلیدواژه باشد.',
      'یکی از زیرعنوان‌های H2 یا H3 را با کلیدواژه کانونی بنویسید.'
    );

    const occurrences = countOccurrences(plainContent, kw);
    const kwWords = kw.split(/\s+/).length;
    const density = wordCount > 0 ? ((occurrences * kwWords) / wordCount) * 100 : 0;
    const densityOk = density >= 0.5 && density <= 3;
    add(
      'kw-density',
      'keyword',
      `تراکم کلیدواژه: ${density.toFixed(1)}٪ (${occurrences} بار)`,
      densityOk ? 'pass' : occurrences === 0 ? 'fail' : 'warn',
      2,
      densityOk ? undefined : 'تراکم مناسب بین ۰٫۵٪ تا ۳٪ است.',
      occurrences === 0
        ? 'کلیدواژه اصلاً در متن نیامده — آن را به‌صورت طبیعی چند بار در متن به کار ببرید.'
        : density > 3
          ? 'کلیدواژه بیش از حد تکرار شده (keyword stuffing)؛ برخی تکرارها را با مترادف جایگزین کنید.'
          : 'کلیدواژه را چند بار بیشتر و به‌صورت طبیعی در متن تکرار کنید.'
    );

    const desc = normalize(input.seoDescription || input.excerpt);
    add(
      'kw-desc',
      'keyword',
      'کلیدواژه در توضیحات متا',
      desc.includes(kw) ? 'pass' : 'warn',
      1,
      desc.includes(kw) ? undefined : 'توضیحات متا شامل کلیدواژه باشد تا در نتایج پررنگ شود.',
      'کلیدواژه کانونی را در توضیحات متا بیاورید — گوگل آن را در نتایج پررنگ نشان می‌دهد.'
    );
  }

  // ================= عنوان و متا =================
  const titleLen = (input.seoTitle || input.title).length;
  add(
    'title-len',
    'meta',
    `طول عنوان سئو: ${titleLen} نویسه`,
    titleLen >= 30 && titleLen <= 65 ? 'pass' : titleLen > 0 ? 'warn' : 'fail',
    2,
    'طول مناسب بین ۳۰ تا ۶۵ نویسه است تا در نتایج گوگل بریده نشود.',
    titleLen < 30
      ? 'عنوان سئو کوتاه است — آن را توصیفی‌تر کنید (۳۰ تا ۶۵ نویسه).'
      : titleLen > 65
        ? 'عنوان سئو بلند است و در گوگل بریده می‌شود — زیر ۶۵ نویسه نگهش دارید.'
        : undefined
  );

  const descLen = (input.seoDescription || input.excerpt).length;
  add(
    'desc-len',
    'meta',
    `طول توضیحات متا: ${descLen} نویسه`,
    descLen >= 70 && descLen <= 160 ? 'pass' : descLen > 0 ? 'warn' : 'fail',
    2,
    'طول مناسب بین ۷۰ تا ۱۶۰ نویسه است.',
    descLen === 0
      ? 'توضیحات متا بنویسید — همین متن زیر عنوان در نتایج گوگل دیده می‌شود و نرخ کلیک را بالا می‌برد.'
      : descLen < 70
        ? 'توضیحات متا کوتاه است — آن را به ۷۰ تا ۱۶۰ نویسه برسانید.'
        : 'توضیحات متا بلند است و بریده می‌شود — زیر ۱۶۰ نویسه نگهش دارید.'
  );

  add(
    'slug-len',
    'meta',
    `طول اسلاگ: ${input.slug.length} نویسه`,
    input.slug.length > 0 && input.slug.length <= 75 ? 'pass' : 'warn',
    1,
    'اسلاگ کوتاه و گویا بهتر رتبه می‌گیرد (حداکثر ~۷۵ نویسه).',
    'اسلاگ را کوتاه کنید؛ فقط کلیدواژه و کلمات اصلی بمانند.'
  );

  // ================= محتوا =================
  add(
    'words',
    'content',
    `تعداد کلمات: ${wordCount}`,
    wordCount >= 600 ? 'pass' : wordCount >= 300 ? 'warn' : 'fail',
    3,
    wordCount >= 600 ? undefined : 'مقاله‌های بالای ۶۰۰ کلمه شانس رتبه بهتری دارند (حداقل ۳۰۰).',
    wordCount < 300
      ? 'متن خیلی کوتاه است — مقاله را به دست‌کم ۳۰۰ و ترجیحاً بالای ۶۰۰ کلمه برسانید.'
      : 'متن را کامل‌تر کنید؛ مقاله‌های بالای ۶۰۰ کلمه معمولاً رتبه بهتری می‌گیرند.'
  );

  const headingCount = (input.contentMd.match(/^#{2,4}\s/gm) || []).length;
  add(
    'headings',
    'content',
    `زیرعنوان‌ها: ${headingCount} عدد`,
    headingCount >= 2 ? 'pass' : headingCount === 1 ? 'warn' : 'fail',
    2,
    'متن را با زیرعنوان (##) بخش‌بندی کنید؛ هم خوانایی هم سئو.',
    'متن را با زیرعنوان‌های ## بخش‌بندی کنید — هم خواننده راحت‌تر می‌خواند هم گوگل ساختار را می‌فهمد.'
  );

  if (headingCount > 0 && wordCount > 0) {
    const wordsPerHeading = Math.round(wordCount / headingCount);
    add(
      'heading-density',
      'content',
      `میانگین ${wordsPerHeading} کلمه بین زیرعنوان‌ها`,
      wordsPerHeading <= 300 ? 'pass' : 'warn',
      1,
      wordsPerHeading <= 300 ? undefined : 'بخش‌های بالای ۳۰۰ کلمه را با زیرعنوان تازه بشکنید.',
      'بین زیرعنوان‌ها متن طولانی شده — هر ~۳۰۰ کلمه یک زیرعنوان تازه اضافه کنید.'
    );
  }

  const hasConclusion = /^#{2,4}\s.*(جمع‌بندی|نتیجه|سخن پایانی|کلام آخر)/m.test(input.contentMd);
  add(
    'conclusion',
    'content',
    hasConclusion ? 'بخش جمع‌بندی دارد' : 'بخش جمع‌بندی ندارد',
    hasConclusion ? 'pass' : 'warn',
    1,
    hasConclusion ? undefined : 'یک زیرعنوان «جمع‌بندی» در پایان، تجربه خواندن و ماندگاری کاربر را بهتر می‌کند.',
    'در پایان مقاله یک بخش «جمع‌بندی» یا «نتیجه‌گیری» اضافه کنید.'
  );

  // ================= خوانایی =================
  const paras = input.contentMd.split(/\n\s*\n/).filter((p) => p.trim() && !/^#{1,6}\s/.test(p.trim()));
  const longParas = paras.filter((p) => stripMd(p).split(/\s+/).filter(Boolean).length > 150).length;
  add(
    'para-len',
    'readability',
    longParas === 0 ? 'طول پاراگراف‌ها مناسب است' : `${longParas} پاراگراف خیلی بلند`,
    longParas === 0 ? 'pass' : 'warn',
    2,
    longParas === 0 ? undefined : 'پاراگراف‌های بالای ۱۵۰ کلمه را بشکنید.',
    'پاراگراف‌های بلند را به پاراگراف‌های ۳ تا ۵ جمله‌ای بشکنید — دیوار متن خواننده را فراری می‌دهد.'
  );

  const sentences = stripMd(input.contentMd)
    .split(/[.!؟?…؛]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
  const longSentences = sentences.filter((s) => s.split(/\s+/).filter(Boolean).length > 25).length;
  const longPct = sentences.length > 0 ? (longSentences / sentences.length) * 100 : 0;
  add(
    'sentence-len',
    'readability',
    sentences.length === 0
      ? 'جمله‌ای برای بررسی نیست'
      : `${Math.round(longPct)}٪ جمله‌های بلند (بالای ۲۵ کلمه)`,
    sentences.length === 0 ? 'warn' : longPct <= 25 ? 'pass' : 'warn',
    2,
    'حداکثر ۲۵٪ جمله‌ها بلند باشند؛ جمله کوتاه یعنی خوانایی بهتر.',
    'جمله‌های خیلی بلند را به دو جمله بشکنید؛ جمله‌های کوتاه اعتماد و خوانایی می‌سازند.'
  );

  const introWords = stripMd(input.contentMd.split(/\n\s*\n/)[0] || '')
    .split(/\s+/)
    .filter(Boolean).length;
  add(
    'intro-len',
    'readability',
    `مقدمه: ${introWords} کلمه`,
    introWords >= 30 && introWords <= 130 ? 'pass' : 'warn',
    1,
    'مقدمه ۳۰ تا ۱۳۰ کلمه‌ای، خواننده را نگه می‌دارد و نرخ پرش را کم می‌کند.',
    introWords < 30
      ? 'مقدمه را کمی بلندتر کنید (۳۰ تا ۱۳۰ کلمه) و در آن بگویید خواننده چه چیزی یاد می‌گیرد.'
      : 'مقدمه بلند است — آن را فشرده کنید تا خواننده سریع به اصل مطلب برسد.'
  );

  const listBlocks = (input.contentMd.match(/^(\s*)([-*]|\d+[.)])\s/gm) || []).length;
  add(
    'lists',
    'readability',
    listBlocks > 0 ? 'از فهرست استفاده شده' : 'فهرستی در متن نیست',
    listBlocks > 0 ? 'pass' : 'warn',
    1,
    listBlocks > 0 ? undefined : 'فهرست‌های نقطه‌ای اسکن کردن متن را آسان می‌کنند.',
    'بخشی از اطلاعات را به فهرست نقطه‌ای یا شماره‌دار تبدیل کنید — گوگل از آن‌ها Featured Snippet می‌سازد.'
  );

  // ================= تصویر و پیوند =================
  const allLinks = [...input.contentMd.matchAll(/\[[^\]]+\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]);
  const host = (input.siteHost || '').replace(/^www\./, '');
  const internal = host
    ? allLinks.filter((u) => u.startsWith('/') || u.includes(host)).length
    : allLinks.filter((u) => u.startsWith('/')).length;
  const external = allLinks.length - internal;

  add(
    'internal-links',
    'media',
    internal > 0 ? `پیوند داخلی: ${internal} عدد` : 'پیوند داخلی ندارد',
    internal > 0 ? 'pass' : 'warn',
    2,
    internal > 0 ? undefined : 'پیوند به صفحات دیگر همان سایت، قدرت سئو را پخش می‌کند.',
    'به ۲ تا ۳ مقاله یا صفحه دیگر همین سایت پیوند بدهید — پیوند داخلی از مهم‌ترین ابزارهای سئوی داخلی است.'
  );
  add(
    'external-links',
    'media',
    external > 0 ? `پیوند خارجی: ${external} عدد` : 'پیوند خارجی ندارد',
    external > 0 ? 'pass' : 'warn',
    1,
    external > 0 ? undefined : 'یک پیوند به منبع معتبر، اعتبار محتوا را بالا می‌برد.',
    'به یک منبع معتبر خارجی (آمار، تحقیق، مستندات) پیوند بدهید.'
  );

  const images = (input.contentMd.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
  const imagesNoAlt = (input.contentMd.match(/!\[\s*\]\([^)]*\)/g) || []).length;
  add(
    'images',
    'media',
    images > 0 ? `تصاویر داخل متن: ${images} عدد` : 'تصویری داخل متن نیست',
    images > 0 ? (imagesNoAlt > 0 ? 'warn' : 'pass') : 'warn',
    1,
    imagesNoAlt > 0
      ? `${imagesNoAlt} تصویر متن جایگزین (alt) ندارد.`
      : images === 0
        ? 'دست‌کم یک تصویر مرتبط اضافه کنید.'
        : undefined,
    imagesNoAlt > 0
      ? 'برای همه تصاویر متن جایگزین (alt) بنویسید — گوگل تصویر را از روی alt می‌فهمد.'
      : 'هر ۳۰۰ تا ۵۰۰ کلمه یک تصویر مرتبط اضافه کنید تا متن نفس بکشد.'
  );

  add('cover', 'media', input.coverUrl ? 'تصویر شاخص دارد' : 'تصویر شاخص ندارد', input.coverUrl ? 'pass' : 'warn', 1, undefined, 'تصویر شاخص ۱۲۰۰×۶۳۰ انتخاب کنید — بدون آن، اشتراک‌گذاری لینک جذابیتی ندارد.');
  if (input.coverUrl) {
    add(
      'cover-alt',
      'media',
      input.coverAlt ? 'متن جایگزین تصویر شاخص دارد' : 'متن جایگزین تصویر شاخص خالی است',
      input.coverAlt ? 'pass' : 'warn',
      1,
      undefined,
      'برای تصویر شاخص متن جایگزین (alt) بنویسید و اگر شد کلیدواژه را در آن بیاورید.'
    );
  }

  // ================= امتیازها =================
  const scoreOf = (list: SeoCheck[]) => {
    const total = list.reduce((s, c) => s + c.weight, 0);
    const earned = list.reduce(
      (s, c) => s + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight / 2 : 0),
      0
    );
    return total > 0 ? Math.round((earned / total) * 100) : 0;
  };

  const readabilityChecks = checks.filter((c) => c.group === 'readability');
  const seoChecks = checks.filter((c) => c.group !== 'readability');
  const score = scoreOf(seoChecks);
  const readability = scoreOf(readabilityChecks);

  const suggestions = checks
    .filter((c) => c.status !== 'pass' && c.suggestion)
    .sort((a, b) => (b.status === 'fail' ? b.weight + 10 : b.weight) - (a.status === 'fail' ? a.weight + 10 : a.weight))
    .slice(0, 6)
    .map((c) => ({ text: c.suggestion!, priority: c.status === 'fail' ? 2 : 1 }));

  const occurrences = kw ? countOccurrences(plainContent, kw) : 0;
  const kwWords = kw ? kw.split(/\s+/).length : 1;
  const keywordDensity = wordCount > 0 ? ((occurrences * kwWords) / wordCount) * 100 : 0;

  return { score, readability, checks, suggestions, wordCount, readingMinutes, keywordDensity };
}
