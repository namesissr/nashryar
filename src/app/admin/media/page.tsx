'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Upload, Trash2, Copy, Check } from 'lucide-react';
import { Button, Spinner, EmptyState } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';
import { faNum, faDate } from '@/lib/utils';

type MediaItem = { id: string; url: string; fileName: string; alt: string | null; size: number; createdAt: string };

export default function MediaPage() {
  const { data, isLoading, mutate } = useSWR<{ media: MediaItem[] }>('/api/admin/media', fetcher);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  async function upload(file: File) {
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/media', { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(json.error || 'آپلود ناموفق بود');
      return;
    }
    mutate();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    mutate();
  }

  function copy(url: string) {
    navigator.clipboard.writeText(`${location.origin}${url}`).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">رسانه</h1>
          <p className="mt-1 text-sm text-slate-500">
            تصاویر مقاله‌ها اینجا نگهداری می‌شوند و هنگام انتشار با آدرس کامل به سایت مقصد می‌روند.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button loading={uploading} onClick={() => inputRef.current?.click()}>
          <Upload size={15} />
          آپلود تصویر
        </Button>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30">{error}</p>}

      {isLoading ? (
        <Spinner />
      ) : !data || data.media.length === 0 ? (
        <EmptyState title="هنوز تصویری آپلود نشده" subtitle="تصاویر با حداکثر حجم ۵ مگابایت پشتیبانی می‌شوند." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.media.map((m) => (
            <div
              key={m.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="relative aspect-square bg-slate-50 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt || m.fileName} className="h-full w-full object-cover" />
                <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/50 group-hover:flex">
                  <button
                    onClick={() => copy(m.url)}
                    className="rounded-lg bg-white/90 p-2 text-slate-700 hover:bg-white"
                    title="کپی آدرس"
                  >
                    {copied === m.url ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    className="rounded-lg bg-white/90 p-2 text-rose-600 hover:bg-white"
                    title="حذف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="p-2.5 text-[11px] text-slate-400">
                <p className="truncate" dir="ltr">
                  {m.fileName}
                </p>
                <p className="mt-0.5">
                  {faNum(Math.round(m.size / 1024))} کیلوبایت · {faDate(m.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
