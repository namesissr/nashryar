'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Globe,
  FolderTree,
  Image as ImageIcon,
  BarChart3,
  CalendarClock,
  Sparkles,
  SlidersHorizontal,
  MoreHorizontal,
  Users,
  PenLine,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  exact?: boolean;
  adminOnly?: boolean;
}[] = [
  { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
  { href: '/admin/articles', label: 'مقاله‌ها', icon: FileText },
  { href: '/admin/schedule', label: 'زمان‌بندی', icon: CalendarClock },
  { href: '/admin/seo', label: 'ممیزی سئو', icon: Sparkles },
  { href: '/admin/blog-settings', label: 'تنظیمات وبلاگ', icon: SlidersHorizontal },
  { href: '/admin/sites', label: 'سایت‌ها', icon: Globe },
  { href: '/admin/categories', label: 'دسته‌بندی‌ها', icon: FolderTree },
  { href: '/admin/media', label: 'رسانه', icon: ImageIcon },
  { href: '/admin/users', label: 'نویسندگان', icon: Users, adminOnly: true },
  { href: '/admin/reports', label: 'گزارش و آمار', icon: BarChart3 },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.classList.toggle('dark');
    try {
      localStorage.setItem('ns-theme', dark ? 'dark' : 'light');
    } catch {}
  }

  const nav = (
    <nav className="space-y-1">
      {NAV.filter((item) => !item.adminOnly || user.role === 'ADMIN').map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* سایدبار دسکتاپ */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-60 flex-col border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <PenLine size={18} />
          </div>
          <div>
            <p className="font-extrabold leading-5">نشریار</p>
            <p className="text-[11px] text-slate-400">هاب مرکزی محتوا</p>
          </div>
        </div>
        {nav}
        <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-[11px] text-slate-400">{user.role === 'ADMIN' ? 'مدیر' : 'نویسنده'}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={toggleTheme}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="تغییر تم"
              >
                <Sun size={16} className="hidden dark:block" />
                <Moon size={16} className="dark:hidden" />
              </button>
              <button
                onClick={logout}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                title="خروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* هدر موبایل */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <PenLine size={16} />
          </div>
          <span className="font-extrabold">نشریار</span>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* منوی موبایل */}
      {open && (
        <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-y-0 right-0 w-64 bg-white p-4 pt-20 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <LogOut size={18} />
              خروج
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 pb-24 pt-20 lg:mr-60 lg:p-8 lg:pt-8">{children}</main>

      {/* نوار پیمایش پایین موبایل */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {NAV.slice(0, 4).map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition',
                  active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
                )}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              'flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-bold',
              open ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
            )}
          >
            <MoreHorizontal size={19} />
            بیشتر
          </button>
        </div>
      </nav>
    </div>
  );
}
