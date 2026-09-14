'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Trash2 } from 'lucide-react';
import { Card, Button, Input, Select, Badge, Spinner, EmptyState } from '@/components/ui';
import { fetcher, apiCall } from '@/lib/fetcher';
import { faNum } from '@/lib/utils';

type CategoryRow = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  articleCount: number;
  siteName: string;
  siteColor: string;
};
type SiteRow = { id: string; name: string };

export default function CategoriesPage() {
  const { data, isLoading, mutate } = useSWR<{ categories: CategoryRow[] }>('/api/admin/categories', fetcher);
  const { data: sitesData } = useSWR<{ sites: SiteRow[] }>('/api/admin/sites', fetcher);
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !siteId) return;
    setAdding(true);
    setError('');
    try {
      await apiCall('/api/admin/categories', 'POST', { siteId, name: name.trim() });
      setName('');
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await apiCall(`/api/admin/categories/${id}`, 'DELETE');
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">دسته‌بندی‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">هر سایت دسته‌بندی‌های مخصوص خودش را دارد.</p>
      </div>

      <Card title="افزودن دسته جدید">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select label="سایت" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">انتخاب سایت…</option>
              {sitesData?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Input label="نام دسته" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: آموزش" />
          </div>
          <Button type="submit" loading={adding} disabled={!name.trim() || !siteId}>
            <Plus size={15} />
            افزودن
          </Button>
        </form>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30">{error}</p>}
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !data || data.categories.length === 0 ? (
        <EmptyState title="دسته‌ای وجود ندارد" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="font-bold">{c.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <Badge color={c.siteColor}>{c.siteName}</Badge>
                  <span>{faNum(c.articleCount)} مقاله</span>
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                title="حذف"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
