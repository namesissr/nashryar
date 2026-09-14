'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Upload, X, Trash2 } from 'lucide-react';
import { Button, Spinner, EmptyState } from '@/components/ui';
import { fetcher } from '@/lib/fetcher';

type MediaItem = { id: string; url: string; fileName: string; alt: string | null; size: number };

export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: { url: string; alt: string | null }) => void;
  onClose: () => void;
}) {
  const { data, isLoading, mutate } = useSWR<{ media: MediaItem[] }>('/api/admin/media', fetcher);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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
    await mutate();
    onSelect({ url: json.media.url, alt: json.media.alt });
  }

  async function remove(id: string) {
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-extrabold">کتابخانه رسانه</h3>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <Button size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
              <Upload size={14} />
              آپلود تصویر
            </Button>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={18} />
            </button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30">{error}</p>}
        {isLoading ? (
          <Spinner />
        ) : !data || data.media.length === 0 ? (
          <EmptyState title="هنوز تصویری آپلود نشده" subtitle="با دکمه «آپلود تصویر» شروع کنید." />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {data.media.map((m) => (
              <div key={m.id} className="group relative">
                <button
                  onClick={() => onSelect({ url: m.url, alt: m.alt })}
                  className="block aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:ring-2 hover:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt || m.fileName} className="h-full w-full object-cover" />
                </button>
                <button
                  onClick={() => remove(m.id)}
                  className="absolute left-1.5 top-1.5 hidden rounded-lg bg-black/60 p-1.5 text-white group-hover:block"
                  title="حذف"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
