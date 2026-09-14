// موک «درگاه دریافت هاب» — همان قراردادی که در چهار سایت پیاده شده.
// برای آزمایش سرتاسری انتشار از نشریار بدون نیاز به بالا بودن خود سایت‌ها.
// اجرا: node scripts/mock-receiver.mjs   (پورت 4497، کلید: test-secret)
import http from 'node:http';

const SECRET = process.env.HUB_SECRET || 'test-secret';
const posts = new Map(); // slug -> post
let blogConfig = {}; // تنظیمات وبلاگ اعمال‌شده از هاب

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (!url.pathname.startsWith('/api/hub/blog')) return send(404, { ok: false });
  if (req.headers['x-hub-secret'] !== SECRET) return send(401, { ok: false, error: 'unauthorized' });

  if (url.pathname === '/api/hub/blog/config') {
    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      blogConfig = JSON.parse(body);
      console.log('[mock] config applied:', JSON.stringify(blogConfig));
      return send(200, { ok: true });
    }
    if (req.method === 'GET') return send(200, { ok: true, config: blogConfig });
  }

  if (req.method === 'GET' && url.pathname === '/api/hub/blog/stats') {
    return send(200, {
      ok: true,
      posts: [...posts.values()].map((p) => ({ slug: p.slug, views: p.views })),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/hub/blog') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const existing = posts.get(data.slug);
    posts.set(data.slug, {
      ...data,
      views: existing ? existing.views + 7 : 3, // هر بار انتشار، بازدید ساختگی اضافه می‌شود
    });
    console.log(`[mock] upsert "${data.slug}" published=${data.isPublished} title=${data.title}`);
    return send(200, { ok: true, slug: data.slug, url: `/blog/${data.slug}` });
  }

  const m = url.pathname.match(/^\/api\/hub\/blog\/(.+)$/);
  if (req.method === 'DELETE' && m) {
    const slug = decodeURIComponent(m[1]);
    const had = posts.delete(slug);
    console.log(`[mock] delete "${slug}" → ${had}`);
    return had ? send(200, { ok: true }) : send(404, { ok: false, error: 'not found' });
  }

  send(405, { ok: false });
});

server.listen(4497, () => console.log('mock hub receiver on http://127.0.0.1:4497 (secret: ' + SECRET + ')'));
