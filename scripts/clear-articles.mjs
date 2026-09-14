// پاکسازی مقاله‌ها برای اجرای تمیز آزمایش‌ها (سایت‌ها و کاربران دست نمی‌خورند)
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
await p.articleEvent.deleteMany();
await p.dailyView.deleteMany();
await p.articleTag.deleteMany();
await p.article.deleteMany();
console.log('articles cleared');
await p.$disconnect();
