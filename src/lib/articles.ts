import 'server-only';
import { z } from 'zod';
import prisma from './prisma';
import { slugify, countWords, readingMinutes } from './utils';
import { analyzeSeo } from './seo';

export const articleSchema = z.object({
  siteId: z.string().min(1, 'سایت مقصد را انتخاب کنید'),
  title: z.string().min(3, 'عنوان دست‌کم ۳ نویسه باشد'),
  slug: z.string().optional(),
  excerpt: z.string().nullish(),
  contentMd: z.string().default(''),
  coverUrl: z.string().nullish(),
  coverAlt: z.string().nullish(),
  categoryId: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  focusKeyword: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  canonicalUrl: z.string().nullish(),
  noindex: z.boolean().default(false),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.string().nullish(),
});

export type ArticleInput = z.infer<typeof articleSchema>;

export function computeDerived(
  data: {
    title: string;
    slug?: string | null;
    excerpt?: string | null;
    contentMd: string;
    focusKeyword?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    coverUrl?: string | null;
    coverAlt?: string | null;
  },
  siteHost?: string
) {
  const slug = slugify(data.slug || data.title);
  const wordCount = countWords(data.contentMd);
  const seo = analyzeSeo({
    title: data.title,
    slug,
    excerpt: data.excerpt || '',
    contentMd: data.contentMd,
    focusKeyword: data.focusKeyword || '',
    seoTitle: data.seoTitle || '',
    seoDescription: data.seoDescription || '',
    coverUrl: data.coverUrl || '',
    coverAlt: data.coverAlt || '',
    siteHost,
  });
  return { slug, wordCount, readingMinutes: readingMinutes(wordCount), seoScore: seo.score };
}

/** میزبان سایت از baseUrl — برای تشخیص پیوند داخلی */
export function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** برچسب‌های مقاله را با فهرست تازه جایگزین می‌کند */
export async function syncTags(articleId: string, tags: string[]) {
  await prisma.articleTag.deleteMany({ where: { articleId } });
  for (const raw of tags.map((t) => t.trim()).filter(Boolean)) {
    const tag = await prisma.tag.upsert({ where: { name: raw }, update: {}, create: { name: raw } });
    await prisma.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}
