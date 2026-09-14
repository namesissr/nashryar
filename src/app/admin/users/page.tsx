'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { UserPlus, Trash2, KeyRound, Shield, PenLine, X, Check } from 'lucide-react';
import { Card, Button, Input, Select, Badge, Spinner } from '@/components/ui';
import { fetcher, apiCall } from '@/lib/fetcher';
import { faNum, faDate, cn } from '@/lib/utils';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  articleCount: number;
};

export default function UsersPage() {
  const { data, isLoading, mutate, error } = useSWR<{ users: UserRow[] }>('/api/admin/users', fetcher);

  // فرم افزودن
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('WRITER');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setMsg(null);
    try {
      await apiCall('/api/admin/users', 'POST', { name, email, password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('WRITER');
      setMsg({ ok: true, text: 'کاربر ساخته شد؛ ایمیل و رمز را به او بدهید.' });
      mutate();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'خطا' });
    } finally {
      setAdding(false);
    }
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-rose-600">{error.message || 'دسترسی به این بخش فقط برای مدیر است.'}</p>
      </Card>
    );
  }
  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">نویسندگان و مدیران</h1>
        <p className="mt-1 text-sm text-slate-500">
          مدیر به همه بخش‌ها دسترسی دارد؛ نویسنده فقط می‌تواند مقاله بنویسد و منتشر کند.
        </p>
      </div>

      <Card title="افزودن کاربر جدید">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="نام نمایشی" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: سارا محمدی" required />
          <Input label="ایمیل" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="رمز عبور"
            type="text"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="دست‌کم ۸ نویسه"
            required
          />
          <Select label="نقش" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="WRITER">نویسنده</option>
            <option value="ADMIN">مدیر</option>
          </Select>
          <div className="flex items-end">
            <Button type="submit" loading={adding} className="w-full">
              <UserPlus size={15} />
              افزودن
            </Button>
          </div>
        </form>
        {msg && (
          <p
            className={cn(
              'mt-3 rounded-xl px-3 py-2 text-sm',
              msg.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            )}
          >
            {msg.text}
          </p>
        )}
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-right text-xs text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">مقاله‌ها</th>
                <th className="px-4 py-3 font-medium">عضویت</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.users.map((u) => (
                <UserRowItem key={u.id} user={u} onChanged={() => mutate()} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRowItem({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const [editing, setEditing] = useState<null | 'password' | 'name'>(null);
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');

  async function saveEdit() {
    setErr('');
    try {
      await apiCall(`/api/admin/users/${user.id}`, 'PUT', editing === 'password' ? { password: value } : { name: value });
      setEditing(null);
      setValue('');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    }
  }

  async function toggleRole() {
    setErr('');
    try {
      await apiCall(`/api/admin/users/${user.id}`, 'PUT', { role: user.role === 'ADMIN' ? 'WRITER' : 'ADMIN' });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    }
  }

  async function remove() {
    if (!confirm(`«${user.name}» حذف شود؟ مقاله‌هایش در هاب می‌مانند.`)) return;
    setErr('');
    try {
      await apiCall(`/api/admin/users/${user.id}`, 'DELETE');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    }
  }

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-extrabold text-white',
              user.role === 'ADMIN' ? 'bg-brand-600' : 'bg-violet-500'
            )}
          >
            {user.name.trim().charAt(0) || '؟'}
          </span>
          <div className="min-w-0">
            {editing === 'name' ? (
              <span className="flex items-center gap-1">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                  autoFocus
                />
                <button onClick={saveEdit} className="p-1 text-emerald-600" title="ثبت">
                  <Check size={15} />
                </button>
                <button onClick={() => setEditing(null)} className="p-1 text-slate-400" title="انصراف">
                  <X size={15} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => {
                  setEditing('name');
                  setValue(user.name);
                }}
                className="block truncate font-bold hover:text-brand-600"
                title="ویرایش نام"
              >
                {user.name}
              </button>
            )}
            <p className="truncate text-xs text-slate-400" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
        {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
      </td>
      <td className="px-4 py-3">
        <Badge
          className={
            user.role === 'ADMIN'
              ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          }
        >
          {user.role === 'ADMIN' ? <Shield size={11} /> : <PenLine size={11} />}
          {user.role === 'ADMIN' ? 'مدیر' : 'نویسنده'}
        </Badge>
      </td>
      <td className="px-4 py-3">{faNum(user.articleCount)}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{faDate(user.createdAt)}</td>
      <td className="px-4 py-3">
        {editing === 'password' ? (
          <span className="flex items-center gap-1">
            <input
              dir="ltr"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="رمز جدید (۸+)"
              className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              autoFocus
            />
            <button onClick={saveEdit} className="p-1 text-emerald-600" title="ثبت رمز">
              <Check size={15} />
            </button>
            <button onClick={() => setEditing(null)} className="p-1 text-slate-400" title="انصراف">
              <X size={15} />
            </button>
          </span>
        ) : (
          <span className="flex items-center justify-end gap-1">
            <button
              onClick={toggleRole}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
              title={user.role === 'ADMIN' ? 'تبدیل به نویسنده' : 'تبدیل به مدیر'}
            >
              <Shield size={15} />
            </button>
            <button
              onClick={() => {
                setEditing('password');
                setValue('');
              }}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800"
              title="تغییر رمز عبور"
            >
              <KeyRound size={15} />
            </button>
            <button
              onClick={remove}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
              title="حذف کاربر"
            >
              <Trash2 size={15} />
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
