'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Link2,
  Code,
  SquareCode,
  Table,
  Minus,
  Image as ImageIcon,
  Youtube,
  Eye,
  PenLine,
  Columns2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn, faNum, countWords, readingMinutes } from '@/lib/utils';

export type MarkdownEditorHandle = {
  /** درج متن در محل مکان‌نما */
  insert: (text: string) => void;
};

type ToolDef = {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  shortcut?: string;
  fn: () => void;
};

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onImageRequest: () => void;
    onSave?: () => void;
    minHeight?: number;
  }
>(function MarkdownEditor({ value, onChange, onImageRequest, onSave, minHeight = 420 }, ref) {
  const [tab, setTab] = useState<'write' | 'split' | 'preview'>('write');
  const [fullscreen, setFullscreen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const previewHtml = useMemo(() => {
    if (tab === 'write') return '';
    try {
      return (marked.parse(value, { async: false, gfm: true, breaks: true }) as string).replace(
        /<script[\s\S]*?<\/script>/gi,
        ''
      );
    } catch {
      return '<p>خطا در رندر پیش‌نمایش</p>';
    }
  }, [tab, value]);

  const words = useMemo(() => countWords(value), [value]);
  const headings = useMemo(() => (value.match(/^#{2,4}\s/gm) || []).length, [value]);

  /** دور متن انتخاب‌شده سینتکس بگذار؛ اگر انتخابی نیست placeholder را انتخاب‌شده بگذار */
  function wrap(before: string, after = '', placeholder = '') {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  }

  /** درج یک بلوک در محل مکان‌نما (با خط خالی قبل و بعد) */
  function insertBlock(block: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = value.slice(0, start);
    const needsNl = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const text = needsNl + block + '\n';
    const next = before + text + value.slice(ta.selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.selectionStart = ta.selectionEnd = pos;
    });
  }

  useImperativeHandle(ref, () => ({ insert: insertBlock }));

  /** ادامه خودکار فهرست‌ها با Enter + درج دو فاصله با Tab + میان‌برها */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = taRef.current;
    if (!ta) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        wrap('**', '**', 'متن پررنگ');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        wrap('*', '*', 'متن مورب');
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        wrap('[', '](https://)', 'متن پیوند');
        return;
      }
      if (key === 's' && onSave) {
        e.preventDefault();
        onSave();
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      wrap('  ', '', '');
      return;
    }

    if (e.key === 'Enter') {
      const start = ta.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const line = value.slice(lineStart, start);
      const m = /^(\s*)([-*]\s\[[ x]\]\s|[-*]\s|(\d+)[.)]\s|>\s)(.*)$/.exec(line);
      if (m) {
        e.preventDefault();
        const [, indent, marker, num, rest] = m;
        if (!rest.trim()) {
          // خط خالی فهرست → از فهرست خارج شو
          const next = value.slice(0, lineStart) + value.slice(start);
          onChange(next + (value.slice(start).startsWith('\n') ? '' : ''));
          requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = lineStart;
          });
          return;
        }
        let nextMarker = marker;
        if (num) nextMarker = `${Number(num) + 1}. `;
        if (/\[[ x]\]/.test(marker)) nextMarker = marker.replace(/\[[ x]\]/, '[ ]');
        const insert = `\n${indent}${nextMarker}`;
        const next = value.slice(0, start) + insert + value.slice(ta.selectionEnd);
        onChange(next);
        requestAnimationFrame(() => {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      }
    }
  }

  const groups: ToolDef[][] = [
    [
      { icon: Bold, title: 'پررنگ', shortcut: 'Ctrl+B', fn: () => wrap('**', '**', 'متن پررنگ') },
      { icon: Italic, title: 'مورب', shortcut: 'Ctrl+I', fn: () => wrap('*', '*', 'متن مورب') },
      { icon: Strikethrough, title: 'خط‌خورده', fn: () => wrap('~~', '~~', 'متن خط‌خورده') },
    ],
    [
      { icon: Heading2, title: 'زیرعنوان اصلی (H2)', fn: () => insertBlock('## زیرعنوان') },
      { icon: Heading3, title: 'زیرعنوان فرعی (H3)', fn: () => insertBlock('### زیرعنوان') },
      { icon: Heading4, title: 'زیرعنوان سطح ۴', fn: () => insertBlock('#### زیرعنوان') },
    ],
    [
      { icon: List, title: 'فهرست نقطه‌ای', fn: () => insertBlock('- مورد اول\n- مورد دوم\n- مورد سوم') },
      { icon: ListOrdered, title: 'فهرست شماره‌دار', fn: () => insertBlock('1. مورد اول\n2. مورد دوم\n3. مورد سوم') },
      { icon: ListChecks, title: 'چک‌لیست', fn: () => insertBlock('- [ ] کار اول\n- [ ] کار دوم\n- [x] کار انجام‌شده') },
    ],
    [
      { icon: Quote, title: 'نقل‌قول', fn: () => wrap('\n> ', '\n', 'نقل‌قول') },
      { icon: Code, title: 'کد داخل متن', fn: () => wrap('`', '`', 'code') },
      { icon: SquareCode, title: 'بلوک کد', fn: () => insertBlock('```\nکد شما\n```') },
      {
        icon: Table,
        title: 'جدول',
        fn: () => insertBlock('| ستون یک | ستون دو | ستون سه |\n| --- | --- | --- |\n| مقدار | مقدار | مقدار |\n| مقدار | مقدار | مقدار |'),
      },
      { icon: Minus, title: 'خط جداکننده', fn: () => insertBlock('---') },
    ],
    [
      { icon: Link2, title: 'پیوند', shortcut: 'Ctrl+K', fn: () => wrap('[', '](https://)', 'متن پیوند') },
      { icon: ImageIcon, title: 'درج تصویر از رسانه', fn: onImageRequest },
      {
        icon: Youtube,
        title: 'جاسازی ویدیو (آپارات/یوتیوب)',
        fn: () =>
          insertBlock(
            '<div class="video-embed"><iframe src="آدرس-امبد-ویدیو" width="100%" height="400" frameborder="0" allowfullscreen></iframe></div>'
          ),
      },
    ],
  ];

  const editorPane = (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={'متن مقاله را اینجا بنویسید…\n\nاز ## برای زیرعنوان و ** برای پررنگ کردن استفاده کنید.\nمیان‌برها: Ctrl+B پررنگ · Ctrl+I مورب · Ctrl+K پیوند · Ctrl+S ذخیره'}
      className="w-full resize-y bg-transparent p-4 text-[15px] leading-8 outline-none"
      style={{ minHeight: fullscreen ? 'calc(100vh - 130px)' : minHeight }}
    />
  );

  const previewPane = (
    <div
      className="prose-fa overflow-y-auto p-5"
      style={{ minHeight: fullscreen ? 'calc(100vh - 130px)' : minHeight, maxHeight: fullscreen ? 'calc(100vh - 130px)' : undefined }}
      dangerouslySetInnerHTML={{ __html: previewHtml }}
    />
  );

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        fullscreen && 'fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl'
      )}
    >
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <div className="flex flex-wrap items-center">
          {groups.map((group, gi) => (
            <span key={gi} className="flex items-center">
              {gi > 0 && <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />}
              {group.map((t) => (
                <button
                  key={t.title}
                  onClick={t.fn}
                  title={t.shortcut ? `${t.title} (${t.shortcut})` : t.title}
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <t.icon size={16} />
                </button>
              ))}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(
              [
                ['write', 'نوشتن', PenLine],
                ['split', 'دوبخشی', Columns2],
                ['preview', 'پیش‌نمایش', Eye],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition',
                  key === 'split' && 'hidden lg:flex',
                  tab === key ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'خروج از تمام‌صفحه' : 'حالت تمرکز (تمام‌صفحه)'}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* بدنه */}
      <div className={cn(fullscreen && 'min-h-0 flex-1 overflow-y-auto')}>
        {tab === 'write' && editorPane}
        {tab === 'preview' && previewPane}
        {tab === 'split' && (
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-x-reverse lg:divide-slate-100 dark:lg:divide-slate-800">
            {editorPane}
            {previewPane}
          </div>
        )}
      </div>

      {/* نوار وضعیت */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
        <span>{faNum(words)} کلمه</span>
        <span>{faNum(value.length)} نویسه</span>
        <span>{faNum(readingMinutes(words))} دقیقه مطالعه</span>
        <span>{faNum(headings)} زیرعنوان</span>
        <span className="mr-auto hidden sm:block">Ctrl+S ذخیره · Ctrl+B پررنگ · Ctrl+K پیوند · Enter ادامه خودکار فهرست</span>
      </div>
    </div>
  );
});
