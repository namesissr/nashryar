#!/bin/sh
# نشریار — راه‌اندازی کانتینر:
# ۱) ساخت/به‌روزرسانی جداول دیتابیس  ۲) داده‌های اولیه (بی‌خطر برای اجرای چندباره)  ۳) اجرای اپ
set -e

echo "⏳ آماده‌سازی دیتابیس…"
npx prisma db push --skip-generate
npx tsx prisma/seed.ts

echo "🚀 اجرای نشریار روی پورت 3100"
exec npm run start
