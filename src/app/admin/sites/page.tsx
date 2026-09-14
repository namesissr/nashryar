'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Globe, Plug, RefreshCw, CheckCircle2, XCircle, Save } from 'lucide-react';
import { Card, Button, Input, Badge, Spinner, Select } from '@/components/ui';
import { fetcher, apiCall } from '@/lib/fetcher';
import { faNum } from '@/lib/utils';

type SiteRow = {
  id: string;
  key: string;
  name: string;
  tagline: string | null;
  baseUrl: string;
  apiUrl: string;
  color: string;
  enabled: boolean;
  contentKind: string;
  hasSecret: boolean;
  articleCount: number;
  categoryCount: number;
};

export default function SitesPage() {
  const { data, isLoading, mutate } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">سایت‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          برای هر سایت، آدرس API و کلید محرمانه (همان مقدار HUB_SECRET روی سرور آن سایت) را وارد کنید.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.sites.map((s) => (
          <SiteCard key={s.id} site={s} onChanged={() => mutate()} />
        ))}
      </div>
    </div>
  );
}

function SiteCard({ site, onChanged }: { site: SiteRow; onChanged: () => void }) {
  const [baseUrl, setBaseUrl] = useState(site.baseUrl);
  const [apiUrl, setApiUrl] = useState(site.apiUrl);
  const [secret, setSecret] = useState('');
  const [contentKind, setContentKind] = useState(site.contentKind);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiCall(`/api/admin/sites/${site.id}`, 'PUT', {
        baseUrl,
        apiUrl,
        contentKind,
        ...(secret ? { hubSecret: secret } : {}),
      });
      setSecret('');
      setMsg({ ok: true, text: 'ذخیره شد.' });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'خطا' });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      // اول مقادیر فرم ذخیره می‌شوند تا آزمایش با همان چیزی باشد که کاربر می‌بیند
      await apiCall(`/api/admin/sites/${site.id}`, 'PUT', {
        baseUrl,
        apiUrl,
        contentKind,
        ...(secret ? { hubSecret: secret } : {}),
      });
      if (secret) setSecret('');
      onChanged();
      const res = await fetch(`/api/admin/sites/${site.id}/test`, { method: 'POST' });
      const json = await res.json();
      setMsg(json.ok ? { ok: true, text: json.message } : { ok: false, text: json.error });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'خطا در آزمایش اتصال' });
    } finally {
      setTesting(false);
    }
  }

  async function syncStats() {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/sites/${site.id}/sync-stats`, { method: 'POST' });
      const json = await res.json();
      setMsg(
        json.ok
          ? { ok: true, text: `آمار ${faNum(json.updated)} مقاله همگام شد.` }
          : { ok: false, text: json.error }
      );
      onChanged();
    } catch {
      setMsg({ ok: false, text: 'خطا در همگام‌سازی' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: site.color }} />
          {site.name}
          <span className="text-xs font-normal text-slate-400">{site.tagline}</span>
        </span>
      }
      action={
        <Badge
          className={
            site.hasSecret
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }
        >
          {site.hasSecret ? 'متصل' : 'پیکربندی نشده'}
        </Badge>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Globe size={13} />
            {faNum(site.articleCount)} مقاله
          </span>
          <span>{faNum(site.categoryCount)} دسته</span>
        </div>
        <Input label="آدرس عمومی سایت" dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <Input
          label="آدرس API (درگاه دریافت هاب)"
          dir="ltr"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          hint="معمولاً همان دامنه سایت؛ مسیر /api/hub/blog خودکار اضافه می‌شود."
        />
        <Input
          label={site.hasSecret ? 'کلید محرمانه (برای تغییر، مقدار جدید وارد کنید)' : 'کلید محرمانه (HUB_SECRET)'}
          dir="ltr"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={site.hasSecret ? '••••••••' : 'همان مقدار HUB_SECRET در .env سایت'}
        />
        <Select label="قالب محتوا برای این سایت" value={contentKind} onChange={(e) => setContentKind(e.target.value)}>
          <option value="html">HTML (رندر شده)</option>
          <option value="markdown">Markdown (متن خام)</option>
        </Select>
        {msg && (
          <p
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
              msg.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            }`}
          >
            {msg.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {msg.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={save} loading={saving}>
            <Save size={14} />
            ذخیره
          </Button>
          <Button size="sm" variant="outline" onClick={test} loading={testing}>
            <Plug size={14} />
            آزمایش اتصال
          </Button>
          <Button size="sm" variant="outline" onClick={syncStats} loading={syncing} disabled={!site.hasSecret}>
            <RefreshCw size={14} />
            همگام‌سازی آمار
          </Button>
        </div>
      </div>
    </Card>
  );
}
