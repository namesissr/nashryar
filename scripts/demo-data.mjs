// ساخت یک داده نمونه برای بازبینی ظاهری آمار (بعداً با clear-articles پاک می‌شود)
const BASE = 'http://127.0.0.1:3100';
let cookie = '';
async function api(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res.json().catch(() => null);
}

await api('/api/auth/login', 'POST', { email: 'admin@nashryar.local', password: 'Nashryar!2026' });
const sites = await api('/api/admin/sites');
const siteId = sites.sites.find((s) => s.key === 'arzinoo').id;

for (const title of ['راهنمای کامل خرید بیت‌کوین', 'آموزش تحلیل تکنیکال از صفر', 'بهترین کیف پول‌های ۱۴۰۵']) {
  const c = await api('/api/admin/articles', 'POST', {
    siteId,
    title,
    contentMd: `## مقدمه\n\nمتن نمونه برای ${title}.`,
    focusKeyword: title.split(' ').slice(-2).join(' '),
  });
  await api(`/api/admin/articles/${c.id}/publish`, 'POST', {});
  // انتشار دوباره تا موک بازدید بیشتری بسازد
  await api(`/api/admin/articles/${c.id}/publish`, 'POST', {});
}
await api(`/api/admin/sites/${siteId}/sync-stats`, 'POST');
console.log('demo data ready');
