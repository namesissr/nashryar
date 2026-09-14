// آزمایش سرتاسری نشریار در برابر موک درگاه دریافت (پورت 4497)
// اجرا: node scripts/e2e-test.mjs
const BASE = 'http://127.0.0.1:3100';
let cookie = '';
let failures = 0;

function check(name, cond, extra = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function api(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

console.log('۱) ورود');
{
  const bad = await api('/api/auth/login', 'POST', { email: 'admin@nashryar.local', password: 'wrong' });
  check('رمز اشتباه رد می‌شود (401)', bad.status === 401);
  const ok = await api('/api/auth/login', 'POST', { email: 'admin@nashryar.local', password: 'Nashryar!2026' });
  check('ورود موفق', ok.status === 200, JSON.stringify(ok.json));
}

console.log('۲) پیکربندی سایت ارزینو روی موک');
let siteId;
{
  const sites = await api('/api/admin/sites');
  check('فهرست سایت‌ها ۴ عضو دارد', sites.json?.sites?.length === 4);
  siteId = sites.json.sites.find((s) => s.key === 'arzinoo').id;
  const upd = await api(`/api/admin/sites/${siteId}`, 'PUT', {
    apiUrl: 'http://127.0.0.1:4497',
    hubSecret: 'test-secret',
  });
  check('به‌روزرسانی سایت', upd.status === 200);
  const test = await api(`/api/admin/sites/${siteId}/test`, 'POST');
  check('آزمایش اتصال موفق', test.status === 200 && test.json?.ok === true, JSON.stringify(test.json));

  const wrong = await api(`/api/admin/sites/${siteId}`, 'PUT', { hubSecret: 'bad-secret' });
  const test2 = await api(`/api/admin/sites/${siteId}/test`, 'POST');
  check('کلید اشتباه → خطای 401 قابل فهم', test2.status === 502 && /401/.test(test2.json?.error || ''), JSON.stringify(test2.json));
  await api(`/api/admin/sites/${siteId}`, 'PUT', { hubSecret: 'test-secret' });
}

console.log('۳) ساخت مقاله');
let articleId;
{
  const cats = await api(`/api/admin/categories?siteId=${siteId}`);
  const catId = cats.json.categories[0]?.id || null;
  const create = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'راهنمای کامل خرید بیت‌کوین برای مبتدی‌ها',
    excerpt: 'در این راهنما قدم‌به‌قدم یاد می‌گیرید چطور اولین بیت‌کوین خود را امن و مطمئن بخرید.',
    contentMd:
      '## خرید بیت‌کوین از کجا شروع می‌شود؟\n\nخرید بیت‌کوین برای مبتدی‌ها ساده است اگر مراحل درست را بدانید. در این مقاله همه چیز را توضیح می‌دهیم.\n\n## انتخاب صرافی معتبر\n\nاولین قدم خرید بیت‌کوین انتخاب یک صرافی امن مثل [ارزینو](https://arzinoo.com) است.\n\n- احراز هویت سریع\n- کارمزد شفاف\n- پشتیبانی ۲۴ ساعته\n\n## نگهداری امن\n\nبعد از خرید بیت‌کوین، امنیت کیف پول اهمیت زیادی دارد.',
    categoryId: catId,
    tags: ['بیت‌کوین', 'آموزش'],
    focusKeyword: 'خرید بیت‌کوین',
    seoTitle: 'راهنمای کامل خرید بیت‌کوین برای مبتدی‌ها (گام به گام)',
    seoDescription: 'آموزش قدم‌به‌قدم خرید بیت‌کوین برای مبتدی‌ها: انتخاب صرافی، احراز هویت، خرید امن و نگهداری. همین حالا شروع کنید.',
  });
  check('ساخت مقاله', create.status === 200 && !!create.json?.id, JSON.stringify(create.json));
  articleId = create.json.id;

  const dup = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'راهنمای کامل خرید بیت‌کوین برای مبتدی‌ها',
    contentMd: 'متن',
  });
  check('اسلاگ تکراری پسوند می‌گیرد', dup.json?.slug?.endsWith('-2'), dup.json?.slug);
  await api(`/api/admin/articles/${dup.json.id}`, 'DELETE');

  const got = await api(`/api/admin/articles/${articleId}`);
  check('امتیاز سئو محاسبه شده (>۶۰)', (got.json?.article?.seoScore ?? 0) > 60, `score=${got.json?.article?.seoScore}`);
  check('وضعیت اولیه پیش‌نویس', got.json?.article?.status === 'DRAFT');
}

console.log('۴) انتشار');
{
  const pub = await api(`/api/admin/articles/${articleId}/publish`, 'POST', {});
  check('انتشار موفق', pub.status === 200 && pub.json?.ok === true, JSON.stringify(pub.json));
  const got = await api(`/api/admin/articles/${articleId}`);
  check('وضعیت → منتشرشده', got.json?.article?.status === 'PUBLISHED');
  check('syncedAt ثبت شد', !!got.json?.article?.syncedAt);
  check('publishedAt ثبت شد', !!got.json?.article?.publishedAt);
  const firstPublishedAt = got.json.article.publishedAt;

  // انتشار دوباره (به‌روزرسانی) نباید تاریخ انتشار را عوض کند
  const pub2 = await api(`/api/admin/articles/${articleId}/publish`, 'POST', {});
  check('به‌روزرسانی روی سایت موفق', pub2.status === 200);
  const got2 = await api(`/api/admin/articles/${articleId}`);
  check('تاریخ انتشار اولیه حفظ شد', got2.json.article.publishedAt === firstPublishedAt);
}

console.log('۵) همگام‌سازی آمار');
{
  const sync = await api(`/api/admin/sites/${siteId}/sync-stats`, 'POST');
  check('همگام‌سازی موفق', sync.status === 200 && sync.json?.ok === true, JSON.stringify(sync.json));
  const got = await api(`/api/admin/articles/${articleId}`);
  check('بازدید از سایت خوانده شد (>0)', (got.json?.article?.remoteViews ?? 0) > 0, `views=${got.json?.article?.remoteViews}`);
  const stats = await api('/api/admin/stats');
  check('نمودار ۳۰ روزه داده دارد', stats.json?.series?.some((r) => r.total > 0));
  check('آمار سایت ارزینو بازدید دارد', stats.json?.sites?.find((s) => s.key === 'arzinoo')?.views > 0);
}

console.log('۶) برداشتن از سایت و حذف');
{
  const unpub = await api(`/api/admin/articles/${articleId}/publish`, 'POST', { unpublish: true });
  check('برداشتن از سایت موفق', unpub.status === 200);
  const got = await api(`/api/admin/articles/${articleId}`);
  check('وضعیت → بایگانی', got.json?.article?.status === 'ARCHIVED');

  const del = await api(`/api/admin/articles/${articleId}`, 'DELETE');
  check('حذف کامل (هاب + سایت مقصد)', del.status === 200, JSON.stringify(del.json));
}

console.log('۷) زمان‌بندی برای زمان مشخص');
{
  const create = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'مقاله زمان‌بندی‌شده آزمایشی',
    contentMd: 'متن آزمایشی برای زمان‌بندی انتشار خودکار در نشریار.',
  });
  const schedId = create.json.id;

  const past = await api(`/api/admin/articles/${schedId}/schedule`, 'POST', {
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
  });
  check('زمان گذشته رد می‌شود', past.status === 400);

  const soon = new Date(Date.now() + 2000).toISOString();
  const sched = await api(`/api/admin/articles/${schedId}/schedule`, 'POST', { publishedAt: soon });
  check('زمان‌بندی ثبت شد', sched.status === 200);
  let got = await api(`/api/admin/articles/${schedId}`);
  check('وضعیت → زمان‌بندی‌شده', got.json?.article?.status === 'SCHEDULED');

  // پیش از موعد: تیک نباید منتشرش کند... صبر تا موعد برسد
  await new Promise((r) => setTimeout(r, 2500));
  const run = await api('/api/admin/schedule/run', 'POST');
  check('تیک زمان‌بند اجرا شد', run.status === 200, JSON.stringify(run.json));
  got = await api(`/api/admin/articles/${schedId}`);
  check('در موعد، خودکار منتشر شد', got.json?.article?.status === 'PUBLISHED', got.json?.article?.status);
  check('تاریخ انتشار = زمان زمان‌بندی', got.json?.article?.publishedAt === soon, got.json?.article?.publishedAt);

  // لغو زمان‌بندی روی یک مقاله دیگر
  const c2 = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'مقاله زمان‌بندی برای لغو',
    contentMd: 'متن.',
  });
  await api(`/api/admin/articles/${c2.json.id}/schedule`, 'POST', {
    publishedAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const cancel = await api(`/api/admin/articles/${c2.json.id}/queue`, 'DELETE');
  check('لغو زمان‌بندی', cancel.status === 200);
  const got2 = await api(`/api/admin/articles/${c2.json.id}`);
  check('بازگشت به پیش‌نویس', got2.json?.article?.status === 'DRAFT');

  await api(`/api/admin/articles/${schedId}`, 'DELETE');
  await api(`/api/admin/articles/${c2.json.id}`, 'DELETE');
}

console.log('۸) صف انتشار خودکار');
{
  // برنامه: ۳ مقاله در روز، ساعت‌های ثابتی که همه گذشته‌اند، همه روزهای هفته
  const plan = await api(`/api/admin/sites/${siteId}`, 'PUT', {
    autoPublishEnabled: true,
    autoPerDay: 3,
    autoMode: 'times',
    autoTimes: '00:00,00:01,00:02',
    autoDays: '0,1,2,3,4,5,6',
  });
  check('ذخیره برنامه سایت', plan.status === 200, JSON.stringify(plan.json));

  const mk = async (t) =>
    (await api('/api/admin/articles', 'POST', { siteId, title: t, contentMd: 'متن صف: ' + t })).json.id;
  const qa = await mk('مقاله صف اول');
  const qb = await mk('مقاله صف دوم');
  const qc = await mk('مقاله صف سوم و چهارم نمی‌شود');

  const q1 = await api(`/api/admin/articles/${qa}/queue`, 'POST');
  const q2 = await api(`/api/admin/articles/${qb}/queue`, 'POST');
  await api(`/api/admin/articles/${qc}/queue`, 'POST');
  check('افزودن به صف با جایگاه درست', q1.json?.position === 1 && q2.json?.position === 2);

  // بازچینش: qc اول شود
  const reorder = await api('/api/admin/schedule/reorder', 'POST', { siteId, ids: [qc, qa, qb] });
  check('بازچینش صف', reorder.status === 200);

  const view = await api('/api/admin/schedule');
  const sitePlan = view.json?.sites?.find((s) => s.id === siteId);
  check('نمای زمان‌بندی: صف ۳تایی', sitePlan?.queue?.length === 3);
  check('نمای زمان‌بندی: ۳ نوبت امروز', sitePlan?.todaySlots?.length === 3);
  check('اولین صف پس از بازچینش', sitePlan?.queue?.[0]?.id === qc, sitePlan?.queue?.[0]?.title);

  const run = await api('/api/admin/schedule/run', 'POST');
  check('اجرای صف', run.status === 200 && run.json?.queuePublished?.length === 3, JSON.stringify(run.json));

  const after = await api('/api/admin/schedule');
  const sp2 = after.json?.sites?.find((s) => s.id === siteId);
  check('صف خالی شد', sp2?.queue?.length === 0);
  check('شمارش امروز = ۳', sp2?.publishedToday === 3, `publishedToday=${sp2?.publishedToday}`);

  // اجرای دوباره نباید بیشتر از سهمیه منتشر کند
  const qd = await mk('مقاله اضافه بر سهمیه');
  await api(`/api/admin/articles/${qd}/queue`, 'POST');
  const run2 = await api('/api/admin/schedule/run', 'POST');
  check('سهمیه روزانه رعایت شد', run2.json?.queuePublished?.length === 0, JSON.stringify(run2.json?.queuePublished));
  const gotD = await api(`/api/admin/articles/${qd}`);
  check('مقاله اضافه در صف ماند', gotD.json?.article?.status === 'QUEUED');

  // پاکسازی
  await api(`/api/admin/sites/${siteId}`, 'PUT', { autoPublishEnabled: false });
  for (const id of [qa, qb, qc, qd]) await api(`/api/admin/articles/${id}`, 'DELETE');
}

console.log('۹) نویسندگان و مدیران');
{
  const list = await api('/api/admin/users');
  check('فهرست کاربران', list.status === 200 && Array.isArray(list.json?.users));

  const short = await api('/api/admin/users', 'POST', {
    name: 'نویسنده آزمایشی',
    email: 'writer@test.local',
    password: '123',
    role: 'WRITER',
  });
  check('رمز کوتاه رد می‌شود', short.status === 400);

  const create = await api('/api/admin/users', 'POST', {
    name: 'نویسنده آزمایشی',
    email: 'writer@test.local',
    password: 'Writer!Pass1',
    role: 'WRITER',
  });
  check('ساخت نویسنده', create.status === 200, JSON.stringify(create.json));
  const writerId = create.json.id;

  const dup = await api('/api/admin/users', 'POST', {
    name: 'تکراری',
    email: 'writer@test.local',
    password: 'Writer!Pass1',
    role: 'WRITER',
  });
  check('ایمیل تکراری رد می‌شود (409)', dup.status === 409);

  const meId = (await api('/api/admin/users')).json.users.find((u) => u.email === 'admin@nashryar.local').id;
  const demoteSelf = await api(`/api/admin/users/${meId}`, 'PUT', { role: 'WRITER' });
  check('پایین آوردن نقش خود رد می‌شود', demoteSelf.status === 409);
  const delSelf = await api(`/api/admin/users/${meId}`, 'DELETE');
  check('حذف حساب خود رد می‌شود', delSelf.status === 409);

  const promote = await api(`/api/admin/users/${writerId}`, 'PUT', { role: 'ADMIN' });
  check('ارتقا به مدیر', promote.status === 200);
  const demote = await api(`/api/admin/users/${writerId}`, 'PUT', { role: 'WRITER' });
  check('بازگشت به نویسنده', demote.status === 200);
  const newPass = await api(`/api/admin/users/${writerId}`, 'PUT', { password: 'NewWriter!Pass2' });
  check('تغییر رمز نویسنده', newPass.status === 200);

  // ورود با حساب نویسنده و بررسی محدودیت دسترسی
  const adminCookie = cookie;
  cookie = '';
  const wLogin = await api('/api/auth/login', 'POST', { email: 'writer@test.local', password: 'NewWriter!Pass2' });
  check('ورود نویسنده با رمز جدید', wLogin.status === 200);
  const wUsers = await api('/api/admin/users');
  check('نویسنده به مدیریت کاربران دسترسی ندارد (403)', wUsers.status === 403);
  const wArticles = await api('/api/admin/articles');
  check('نویسنده به مقاله‌ها دسترسی دارد', wArticles.status === 200);

  cookie = adminCookie;
  const del = await api(`/api/admin/users/${writerId}`, 'DELETE');
  check('حذف نویسنده', del.status === 200);
}

console.log('۱۰) ابزارهای سئو (کلیدواژه تکراری + ممیزی)');
{
  const mk = async (t, kw) =>
    (
      await api('/api/admin/articles', 'POST', {
        siteId,
        title: t,
        contentMd: '## مقدمه\n\nمتن آزمایشی برای ممیزی سئو.',
        focusKeyword: kw,
      })
    ).json.id;
  const a1 = await mk('مقاله سئو یک', 'کیف پول سخت‌افزاری');
  const a2 = await mk('مقاله سئو دو', 'کیف پول سخت‌افزاری');
  const a3 = await mk('مقاله سئو سه', 'استیکینگ اتریوم');

  const dup = await api(
    `/api/admin/seo/keyword-check?siteId=${siteId}&keyword=${encodeURIComponent('کیف پول سخت‌افزاری')}&excludeId=${a1}`
  );
  check('تشخیص کلیدواژه تکراری', dup.json?.duplicates?.length === 1, JSON.stringify(dup.json));
  const noDup = await api(
    `/api/admin/seo/keyword-check?siteId=${siteId}&keyword=${encodeURIComponent('کلیدواژه یکتا')}`
  );
  check('کلیدواژه یکتا تکراری نیست', noDup.json?.duplicates?.length === 0);

  const audit = await api(`/api/admin/seo/audit?siteId=${siteId}`);
  check('ممیزی سئو اجرا شد', audit.status === 200 && audit.json?.summary?.total >= 3);
  check(
    'کلیدواژه تکراری در ممیزی دیده شد',
    audit.json?.duplicateKeywords?.some((d) => d.articles.length === 2),
    JSON.stringify(audit.json?.duplicateKeywords)
  );
  const scores = audit.json.articles.map((a) => a.score);
  check(
    'ترتیب ممیزی: ضعیف‌ترها اول',
    scores.every((s, i) => i === 0 || s >= scores[i - 1])
  );
  check('ممیزی هر مقاله مشکلاتش را می‌گوید', audit.json.articles.every((a) => Array.isArray(a.issues)));
  check('امتیاز خوانایی جدا محاسبه می‌شود', typeof audit.json.articles[0]?.readability === 'number');

  for (const id of [a1, a2, a3]) await api(`/api/admin/articles/${id}`, 'DELETE');
}

console.log('۱۱) گزارش بازه‌ای');
{
  // یک مقاله منتشر و آمارش را همگام کن تا بازدید امروز ثبت شود
  const create = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'مقاله گزارش بازه‌ای',
    contentMd: 'متن آزمایشی گزارش.',
  });
  const rid = create.json.id;
  await api(`/api/admin/articles/${rid}/publish`, 'POST', {});
  await api(`/api/admin/sites/${siteId}/sync-stats`, 'POST');

  const today = new Date().toISOString().slice(0, 10);
  const rep = await api(`/api/admin/reports?from=${today}&to=${today}`);
  check('گزارش روزانه', rep.status === 200, JSON.stringify(rep.json?.error));
  check('بازدید امروز در گزارش هست', rep.json?.summary?.totalViews > 0, `views=${rep.json?.summary?.totalViews}`);
  check('انتشار امروز شمرده شد', rep.json?.summary?.published >= 1);
  check('پربازدیدهای بازه', rep.json?.topArticles?.length >= 1);

  const repSite = await api(`/api/admin/reports?from=${today}&to=${today}&siteId=${siteId}`);
  check('گزارش تک‌سایت', repSite.status === 200 && repSite.json?.sites?.length === 1);
  check('ردیف سایت در گزارش', repSite.json?.perSite?.[0]?.views > 0);

  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const rep7 = await api(`/api/admin/reports?from=${weekAgo}&to=${today}`);
  check('گزارش هفتگی: ۷ روز در سری', rep7.json?.series?.length === 7, `len=${rep7.json?.series?.length}`);

  const bad = await api(`/api/admin/reports?from=${today}&to=${weekAgo}`);
  check('بازه معکوس رد می‌شود', bad.status === 400);

  await api(`/api/admin/articles/${rid}`, 'DELETE');
}

console.log('۱۲) تنظیمات وبلاگ سایت');
{
  const cfg = {
    blogTitle: 'مجله ارزینو',
    blogDescription: 'آموزش و تحلیل بازار ارز دیجیتال',
    postsPerPage: 9,
    menu: [
      { label: 'صفحه اصلی', url: '/' },
      { label: 'تعرفه‌ها', url: '/pricing' },
    ],
    categoriesOrder: ['آموزش', 'اخبار', 'تحلیل بازار'],
    showAuthor: true,
    showDate: true,
    showViews: false,
  };
  const save = await api(`/api/admin/sites/${siteId}/blog-config`, 'PUT', cfg);
  check('ذخیره تنظیمات وبلاگ در هاب', save.status === 200);

  const stored = await api(`/api/admin/sites/${siteId}/blog-config`);
  check('خواندن تنظیمات از هاب', stored.json?.config?.blogTitle === 'مجله ارزینو');
  check('دسته‌های سایت همراه تنظیمات', Array.isArray(stored.json?.categories) && stored.json.categories.length >= 3);

  const push = await fetch(`${BASE}/api/admin/sites/${siteId}/blog-config`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const pushJson = await push.json();
  check('اعمال تنظیمات روی سایت (push)', push.status === 200 && pushJson.ok === true, JSON.stringify(pushJson));

  const readBack = await fetch(`${BASE}/api/admin/sites/${siteId}/blog-config?read=1`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const rb = await readBack.json();
  check('خواندن تنظیمات از خود سایت', rb.ok === true && rb.config?.postsPerPage === 9, JSON.stringify(rb.config));
  check('منو روی سایت نشسته', rb.config?.menu?.length === 2);

  const badMenu = await api(`/api/admin/sites/${siteId}/blog-config`, 'PUT', {
    ...cfg,
    menu: Array.from({ length: 11 }, (_, i) => ({ label: `l${i}`, url: '/x' })),
  });
  check('منوی بیش از ۱۰ لینک رد می‌شود', badMenu.status === 400);
}

console.log('۱۲.۵) تنظیمات سئوی سطح سایت');
{
  const cfg = {
    blogTitle: 'مجله ارزینو',
    blogDescription: 'آموزش و تحلیل بازار ارز دیجیتال',
    postsPerPage: 9,
    menu: [{ label: 'صفحه اصلی', url: '/' }],
    categoriesOrder: ['آموزش'],
    showAuthor: true,
    showDate: true,
    showViews: false,
    titleTemplate: '%s | مجله ارزینو',
    defaultOgImage: 'https://arzinoo.com/og-default.jpg',
    organizationName: 'ارزینو',
    organizationLogo: 'https://arzinoo.com/logo.png',
    twitterHandle: '@arzinoo',
    googleVerification: 'abc123verification',
    blogNoindex: false,
    sitemapEnabled: true,
    structuredData: true,
  };
  const save = await api(`/api/admin/sites/${siteId}/blog-config`, 'PUT', cfg);
  check('ذخیره تنظیمات سئوی سایت', save.status === 200, JSON.stringify(save.json));

  const stored = await api(`/api/admin/sites/${siteId}/blog-config`);
  check('قالب عنوان ذخیره شد', stored.json?.config?.titleTemplate === '%s | مجله ارزینو');
  check('کد تأیید گوگل ذخیره شد', stored.json?.config?.googleVerification === 'abc123verification');
  check(
    'کلیدهای بولی سئو ذخیره شدند',
    stored.json?.config?.sitemapEnabled === true && stored.json?.config?.structuredData === true
  );

  const push = await fetch(`${BASE}/api/admin/sites/${siteId}/blog-config`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  check('اعمال تنظیمات سئو روی سایت', push.status === 200);

  const readBack = await fetch(`${BASE}/api/admin/sites/${siteId}/blog-config?read=1`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const rb = await readBack.json();
  check(
    'سئو روی سایت نشست',
    rb.config?.titleTemplate === '%s | مجله ارزینو' && rb.config?.twitterHandle === '@arzinoo',
    JSON.stringify(rb.config)
  );

  const badOg = await api(`/api/admin/sites/${siteId}/blog-config`, 'PUT', {
    ...cfg,
    defaultOgImage: 'x'.repeat(600),
  });
  check('آدرس تصویر بیش از حد بلند رد می‌شود', badOg.status === 400);
}

console.log('۱۲.۶) گزارش فنی سئوی سایت');
{
  const before = await api(`/api/admin/sites/${siteId}/seo-report`);
  check('خواندن گزارش (حتی خالی)', before.status === 200);

  const run = await fetch(`${BASE}/api/admin/sites/${siteId}/seo-report`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const runJson = await run.json();
  check('اجرای بررسی سئو', run.status === 200 && runJson.ok === true, JSON.stringify(runJson).slice(0, 140));
  check('امتیاز عددی دارد', typeof runJson.report?.score === 'number');
  check('فهرست بررسی‌ها پر است', Array.isArray(runJson.report?.checks) && runJson.report.checks.length >= 3);
  check(
    'هر بررسی وضعیت معتبر دارد',
    runJson.report.checks.every((c) => ['pass', 'warn', 'fail'].includes(c.status))
  );
  check('اطلاعات واقعی سایت ثبت شد', typeof runJson.report?.facts?.blogUrl === 'string');

  const after = await api(`/api/admin/sites/${siteId}/seo-report`);
  check('گزارش ذخیره و بازخوانی شد', after.json?.report?.score === runJson.report.score && !!after.json?.checkedAt);
}

console.log('۱۳) آمار کلی سایت‌ها');
{
  const create = await api('/api/admin/articles', 'POST', {
    siteId,
    title: 'مقاله آمار کلی سایت',
    contentMd: 'متن آزمایشی برای آمار جامع.',
  });
  const sid2 = create.json.id;
  await api(`/api/admin/articles/${sid2}/publish`, 'POST', {});
  await api(`/api/admin/sites/${siteId}/sync-stats`, 'POST');

  const stats = await api('/api/admin/site-stats');
  check('آمار سایت‌ها برمی‌گردد', stats.status === 200 && stats.json?.sites?.length === 4);
  check('نام ماه شمسی همراه آمار', typeof stats.json?.monthLabel === 'string' && stats.json.monthLabel.length > 0);
  const az = stats.json.sites.find((s) => s.key === 'arzinoo');
  check('کل منتشرشده سایت', az?.published >= 1, `published=${az?.published}`);
  check('بازدید کل سایت', az?.totalViews > 0, `views=${az?.totalViews}`);
  check('انتشار ماه جاری', az?.publishedThisMonth >= 1);
  check('انتشار هفته اخیر', az?.publishedThisWeek >= 1);
  check('بازدید ماه جاری', az?.viewsThisMonth > 0, `month=${az?.viewsThisMonth}`);
  check('پربازدیدترین مقاله معرفی شد', !!az?.topByViews?.title, JSON.stringify(az?.topByViews));
  check('محبوب‌ترین مقاله ماه معرفی شد', !!az?.topThisMonth?.title && az?.topThisMonth?.monthViews > 0);
  check('بهترین امتیاز سئو معرفی شد', !!az?.bestSeo && typeof az.bestSeo.seoScore === 'number');
  check('میانگین بازدید هر مقاله', az?.avgViewsPerArticle > 0);

  await api(`/api/admin/articles/${sid2}`, 'DELETE');
}

console.log('۱۴) امنیت');
{
  cookie = '';
  const noAuth = await api('/api/admin/articles');
  check('بدون ورود → 401', noAuth.status === 401);
}

console.log(failures === 0 ? '\n🎉 همه آزمایش‌ها موفق' : `\n⚠️ ${failures} آزمایش ناموفق`);
process.exit(failures === 0 ? 0 : 1);
