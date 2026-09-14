import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // مدیر پیش‌فرض — پس از اولین ورود حتماً رمز را عوض کنید
  const passwordHash = await bcrypt.hash('Nashryar!2026', 12);
  await prisma.user.upsert({
    where: { email: 'admin@nashryar.local' },
    update: {},
    create: {
      email: 'admin@nashryar.local',
      passwordHash,
      name: 'مدیر نشریار',
      role: 'ADMIN',
    },
  });

  // چهار سایت مقصد — آدرس‌ها و کلیدها را از «سایت‌ها» در پنل ویرایش کنید
  const sites: {
    key: string;
    name: string;
    tagline: string;
    baseUrl: string;
    color: string;
    contentKind: string;
    sortOrder: number;
    categories: string[];
  }[] = [
    {
      key: 'arzinoo',
      name: 'ارزینو',
      tagline: 'صرافی ارز دیجیتال',
      baseUrl: 'https://arzinoo.com',
      color: '#f59e0b',
      contentKind: 'markdown',
      sortOrder: 1,
      categories: ['اخبار', 'آموزش', 'تحلیل بازار'],
    },
    {
      key: 'chartinoo',
      name: 'چارتینو',
      tagline: 'نمودار و تحلیل تکنیکال',
      baseUrl: 'https://chartinoo.com',
      color: '#3b82f6',
      contentKind: 'html',
      sortOrder: 2,
      categories: ['آموزش', 'تحلیل تکنیکال', 'اخبار'],
    },
    {
      key: 'filminoo',
      name: 'فیلمینو',
      tagline: 'پلتفرم پخش فیلم و سریال',
      baseUrl: 'https://filminoo.com',
      color: '#e11d48',
      contentKind: 'html',
      sortOrder: 3,
      categories: ['معرفی فیلم', 'نقد و بررسی', 'اخبار سینما'],
    },
    {
      key: 'bluepal',
      name: 'بلوپال',
      tagline: 'درگاه پرداخت آنلاین',
      baseUrl: 'https://bluepal.ir',
      color: '#0ea5e9',
      contentKind: 'html',
      sortOrder: 4,
      categories: ['آموزش', 'کسب‌وکار', 'اخبار'],
    },
  ];

  for (const s of sites) {
    const site = await prisma.site.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        name: s.name,
        tagline: s.tagline,
        baseUrl: s.baseUrl,
        apiUrl: s.baseUrl,
        hubSecret: '',
        color: s.color,
        contentKind: s.contentKind,
        sortOrder: s.sortOrder,
      },
    });
    for (const c of s.categories) {
      const slug = c.trim().replace(/\s+/g, '-');
      await prisma.category.upsert({
        where: { siteId_slug: { siteId: site.id, slug } },
        update: {},
        create: { siteId: site.id, name: c, slug },
      });
    }
  }

  console.log('✅ داده‌های اولیه نشریار ساخته شد.');
  console.log('   ورود: admin@nashryar.local / Nashryar!2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
